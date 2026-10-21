import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useChartData from '../../hooks/useChartData';
import { querySqlV09 } from '../../api/query';
import { formatCompactNumber, formatNumber } from '../../utils/formatters';

/** 加载时长（毫秒） */
const LOADING_MS = 3000;
/** 玻璃碎裂动画时长（需与 index.scss 里 osShardFly 保持一致） */
const SHATTER_MS = 780;

/** 搜索建议 SQL：仅数字前缀匹配（该接口不支持 LIKE，用 LEFT() 前缀比较） */
function suggestSql(digits, month) {
  const t = 'dws_taptap_game_set_monthly';
  return `SELECT app_id, MAX(app_name) AS app_name
    FROM ${t}
    WHERE LEFT(app_id, ${digits.length}) = '${digits}'
      AND crawled_at = COALESCE(
        (SELECT MAX(crawled_at) FROM ${t} WHERE crawled_at = '${month}'),
        (SELECT MAX(crawled_at) FROM ${t})
      )
    GROUP BY app_id
    ORDER BY app_id
    LIMIT 8`;
}

/** 当前月份 'YYYY-MM' */
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 三个 Top5 榜单：下载榜(总排名/total_count) / 在线榜(平均在线排名/avg_online_players) / 投放榜(总排名/total_count) */
const TOP_LISTS = [
  { key: 'download', title: '【Top5】下载榜', table: 'dws_taptap_download_rank_monthly', rankCol: 'total_count_rank', valueCol: 'total_count', valueName: '总下载', color: '#7A8B99' },
  { key: 'online', title: '【Top5】在线榜', table: 'dws_taptap_pc_online_peak_players_rank_monthly', rankCol: 'avg_rank', valueCol: 'avg_online_players', valueName: '平均在线', color: '#9CAF9F' },
  { key: 'ad', title: '【Top5】投放榜', table: 'dws_taptap_app_landing_ad_rank_monthly', rankCol: 'total_count_rank', valueCol: 'total_count', valueName: '总投放', color: '#C4A4A4' },
];

/** 榜内数值展示：一律取整(均值也不带小数)；万以下用千分位，万以上用中文紧凑单位 */function fmtValue(v) {
  if (v == null || Number.isNaN(v)) return '-';
  const n = Math.round(v);
  if (Math.abs(n) < 1e4) return formatNumber(n, 0);
  return formatCompactNumber(n);
}

/** 榜单 SQL：优先本月，本月无数据时回退到该表最近有数据的月份 */
function topSql(list, month) {
  const { table, rankCol, valueCol } = list;
  return `SELECT app_id, app_name, ${rankCol} AS rk, ${valueCol} AS val, crawled_at
    FROM ${table}
    WHERE crawled_at = COALESCE(
      (SELECT MAX(crawled_at) FROM ${table} WHERE crawled_at = '${month}'),
      (SELECT MAX(crawled_at) FROM ${table})
    )
    ORDER BY ${rankCol} ASC
    LIMIT 5`;
}

/** 榜单行转换 */
function toTopRows(rows) {
  return (rows || []).map((r) => ({
    appId: r.app_id,
    name: r.app_name != null ? String(r.app_name) : '-',
    rank: Number(r.rk),
    value: r.val == null ? null : Number(r.val),
    month: r.crawled_at,
  }));
}

/** 生成铺满视口的玻璃碎片（每片带随机顶点抖动与飞散方向） */
function useShards(cols = 6, rows = 4) {
  return useMemo(() => {
    const list = [];
    const w = 100 / cols;
    const h = 100 / rows;
    const jitter = (span) => (Math.random() - 0.5) * span;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const left = c * w;
        const top = r * h;
        const pts = [
          [left + jitter(w * 0.5), top + jitter(h * 0.5)],
          [left + w + jitter(w * 0.5), top + jitter(h * 0.5)],
          [left + w + jitter(w * 0.5), top + h + jitter(h * 0.5)],
          [left + jitter(w * 0.5), top + h + jitter(h * 0.5)],
        ]
          .map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`)
          .join(', ');

        // 距画面中心的距离决定飞散力度，整体向外炸开
        const cx = left + w / 2;
        const cy = top + h / 2;
        const spread = 1.9;
        list.push({
          key: `${r}-${c}`,
          left,
          top,
          w,
          h,
          clipPath: `polygon(${pts})`,
          dx: `${(((cx - 50) * spread) + jitter(12)).toFixed(1)}vw`,
          dy: `${(((cy - 50) * spread) + jitter(12)).toFixed(1)}vh`,
          rot: `${((Math.random() - 0.5) * 120).toFixed(0)}deg`,
          delay: `${Math.round(Math.random() * 90)}ms`,
        });
      }
    }
    return list;
  }, [cols, rows]);
}

/**
 * One Search：标题 + 搜索框；点击 Search 后加载 3 秒（0→100%），
 * 随后整页玻璃碎裂并进入报表页面。
 */
export default function OneSearch() {
  const [keyword, setKeyword] = useState('');
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [debounced, setDebounced] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | loading | shatter
  const [percent, setPercent] = useState(0);
  const inputRef = useRef(null);
  const rafRef = useRef(0);
  const timeoutsRef = useRef([]);
  const navigate = useNavigate();
  const shards = useShards();

  /* ===== Top5 榜单（本月，v09） ===== */
  const month = useMemo(currentMonth, []);
  const downloadTopQuery = useChartData(
    `one-search-top-download-${month}`,
    () => querySqlV09(topSql(TOP_LISTS[0], month)),
    {},
    { enabled: true, transform: toTopRows },
  );
  const onlineTopQuery = useChartData(
    `one-search-top-online-${month}`,
    () => querySqlV09(topSql(TOP_LISTS[1], month)),
    {},
    { enabled: true, transform: toTopRows },
  );
  const adTopQuery = useChartData(
    `one-search-top-ad-${month}`,
    () => querySqlV09(topSql(TOP_LISTS[2], month)),
    {},
    { enabled: true, transform: toTopRows },
  );
  const topQueries = [downloadTopQuery, onlineTopQuery, adTopQuery];

  /* ===== 搜索建议（仅数字，防抖 250ms） ===== */
  useEffect(() => {
    const t = setTimeout(() => setDebounced(keyword.trim()), 250);
    return () => clearTimeout(t);
  }, [keyword]);

  const suggestQuery = useChartData(
    `one-search-suggest-${debounced}-${month}`,
    () => querySqlV09(suggestSql(debounced, month)),
    {},
    {
      enabled: debounced.length >= 1,
      staleTime: 60 * 1000,
      transform: (rows) =>
        (rows || []).map((r) => ({
          appId: r.app_id,
          name: r.app_name != null ? String(r.app_name) : '-',
        })),
    },
  );
  const suggestions = suggestQuery.data || [];
  const suggestLoading = suggestQuery.isFetching || debounced !== keyword.trim();

  useEffect(() => {
    inputRef.current?.focus();
    const timeouts = timeoutsRef.current;
    return () => {
      cancelAnimationFrame(rafRef.current);
      timeouts.forEach(clearTimeout);
    };
  }, []);

  const handleSearch = (override) => {
    const value = String(override ?? keyword).trim();
    if (!value || phase !== 'idle') return;

    setPhase('loading');
    setPercent(0);
    const start = performance.now();

    const step = (now) => {
      const p = Math.min(100, ((now - start) / LOADING_MS) * 100);
      setPercent(p);
      if (p < 100) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      // 加载完成 → 玻璃碎裂 → 进入报表页
      setPhase('shatter');
      timeoutsRef.current.push(
        setTimeout(() => {
          navigate(`/one-search/report?q=${encodeURIComponent(value)}`);
        }, SHATTER_MS)
      );
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const busy = phase === 'loading' || phase === 'shatter';

  /** 选中搜索建议 → 直接走搜索流程 */
  const pickSuggestion = (item) => {
    setKeyword(String(item.appId));
    setFocused(false);
    setActiveIndex(-1);
    handleSearch(String(item.appId));
  };

  const onInputKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!suggestions.length) return;
      e.preventDefault();
      setActiveIndex((i) => {
        if (e.key === 'ArrowDown') return (i + 1) % suggestions.length;
        return i <= 0 ? suggestions.length - 1 : i - 1;
      });
      return;
    }
    if (e.key === 'Escape') {
      setFocused(false);
      return;
    }
    if (e.key === 'Enter') {
      if (suggestions.length && activeIndex >= 0) pickSuggestion(suggestions[activeIndex]);
      else handleSearch();
    }
  };

  const showSuggest = focused && !busy && keyword.trim().length > 0;

  return (
    <>
      <div className="position-relative" style={{ minHeight: 'max(calc(100vh - 120px), calc(50vh + 240px))' }}>
        {/* 标题：页面 30% 高度处 */}
        <div
          className="position-absolute start-50 translate-middle-x text-center"
          style={{ top: '30vh', width: '100%', maxWidth: 860, paddingLeft: 16, paddingRight: 16 }}
        >
          <div className="fw-bold" style={{ fontSize: 30, letterSpacing: 1 }}>
            游戏线索查询
          </div>
        </div>

        {/* 搜索框 + 按钮：页面 40% 高度处 */}
        <div
          className="position-absolute start-50 translate-middle-x"
          style={{ top: '40vh', width: '100%', maxWidth: 860, paddingLeft: 16, paddingRight: 16, zIndex: 20 }}
        >
          <div className="position-relative">
          <div className="input-group input-group-lg shadow-sm">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              className="form-control form-control-lg"
              placeholder="输入 APPID 搜索，如 961780"
              value={keyword}
              disabled={busy}
              onChange={(e) => {
                setKeyword(e.target.value.replace(/\D/g, ''));
                setActiveIndex(-1);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={onInputKeyDown}
              aria-label="APPID 搜索"
              style={{ height: 64, fontSize: 18 }}
            />
            <button
              type="button"
              className="btn btn-primary btn-lg px-4 fw-semibold"
              onClick={() => handleSearch()}
              disabled={busy}
              style={{ height: 64, fontSize: 18 }}
            >
              Search
            </button>
          </div>

          {/* 搜索建议下拉：app_id + 游戏名称 */}
          {showSuggest && (
            <div
              className="position-absolute w-100"
              style={{
                top: 'calc(100% + 6px)',
                left: 0,
                zIndex: 40,
                background: '#fff',
                border: '1px solid #EDEFF2',
                borderRadius: 10,
                boxShadow: '0 12px 32px rgba(0,0,0,0.10)',
                maxHeight: 320,
                overflowY: 'auto',
              }}
            >
              {suggestLoading && (
                <div className="text-muted px-3 py-3" style={{ fontSize: 13 }}>检索中…</div>
              )}
              {!suggestLoading && suggestions.length === 0 && (
                <div className="text-muted px-3 py-3" style={{ fontSize: 13 }}>未找到匹配的 APPID</div>
              )}
              {!suggestLoading && suggestions.map((s, i) => (
                <div
                  key={s.appId}
                  className="d-flex align-items-center gap-3 px-3"
                  role="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickSuggestion(s)}
                  onMouseEnter={() => setActiveIndex(i)}
                  style={{
                    paddingTop: 9,
                    paddingBottom: 9,
                    cursor: 'pointer',
                    background: i === activeIndex ? '#F5F7F9' : 'transparent',
                  }}
                >
                  <span className="text-muted" style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', width: 66, flex: '0 0 auto' }}>
                    {s.appId}
                  </span>
                  <span className="text-truncate" style={{ fontSize: 14 }}>{s.name}</span>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>

        {/* Top5 榜单：页面 60% 高度处，与搜索框同宽、三列均分 */}
        <div
          className="position-absolute start-50 translate-middle-x"
          style={{ top: '50vh', width: '100%', maxWidth: 860, paddingLeft: 16, paddingRight: 16 }}
        >
          <div className="d-flex flex-wrap gap-3 align-items-stretch">
            {TOP_LISTS.map((list, i) => {
              const q = topQueries[i];
              const rows = q.data || [];
              return (
                <div key={list.key} className="card border-0 shadow-sm" style={{ flex: '1 1 0', minWidth: 0 }}>
                  <div className="card-body p-3">
                    <div className="d-flex justify-content-between align-items-baseline mb-2">
                      <span className="fw-semibold" style={{ fontSize: 13 }}>{list.title}</span>
                      <span className="text-muted" style={{ fontSize: 11 }}>
                        {rows[0]?.month || month}
                      </span>
                    </div>

                    {q.isLoading && (
                      <div>
                        {[0, 1, 2, 3, 4].map((k) => (
                          <div
                            key={k}
                            style={{ height: 12, borderRadius: 3, background: '#F1F3F5', margin: '7px 0' }}
                          />
                        ))}
                      </div>
                    )}

                    {!q.isLoading && rows.length === 0 && (
                      <div className="text-muted" style={{ fontSize: 12, padding: '18px 0', textAlign: 'center' }}>
                        本月暂无数据
                      </div>
                    )}

                    {!q.isLoading && rows.map((r, idx) => (
                      <div
                        key={`${r.appId}-${idx}`}
                        className="d-flex align-items-center gap-2"
                        role="button"
                        tabIndex={0}
                        onClick={() => { setKeyword(String(r.appId)); handleSearch(r.appId); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') { setKeyword(String(r.appId)); handleSearch(r.appId); }
                        }}
                        title={`搜索 ${r.name}（${r.appId}）`}
                        style={{ padding: '4px 0', cursor: busy ? 'default' : 'pointer' }}
                      >
                        <span
                          className="d-flex align-items-center justify-content-center fw-semibold"
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 4,
                            fontSize: 11,
                            flex: '0 0 auto',
                            background: idx < 3 ? `${list.color}26` : '#F1F3F5',
                            color: idx < 3 ? list.color : '#8A94A0',
                          }}
                        >
                          {idx + 1}
                        </span>
                        <span className="flex-grow-1 d-flex flex-column" style={{ minWidth: 0 }}>
                          <span className="text-truncate" style={{ fontSize: 13 }}>{r.name}</span>
                          <span className="text-muted" style={{ fontSize: 10.5, lineHeight: 1.15 }}>{r.appId}</span>
                        </span>
                        <span
                          className="fw-semibold text-nowrap"
                          style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', flex: '0 0 auto' }}
                          title={`${list.valueName}：${formatNumber(r.value, r.value != null && !Number.isInteger(r.value) ? 2 : 0)}`}
                        >
                          {fmtValue(r.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 加载遮罩（固定 3 秒，百分比 0→100） */}
      {busy && (
        <div className="os-overlay">
          <div
            className="text-white fw-bold"
            style={{ fontSize: 96, lineHeight: 1, letterSpacing: 2, fontVariantNumeric: 'tabular-nums' }}
          >
            {Math.round(percent)}%
          </div>
          <div style={{ width: 280, height: 4, background: 'rgba(255,255,255,0.18)', borderRadius: 2, overflow: 'hidden', marginTop: 20 }}>
            <div style={{ width: `${percent}%`, height: '100%', background: '#fff' }} />
          </div>
          <div className="text-white-50 mt-3 small">正在检索「{keyword.trim()}」…</div>
        </div>
      )}

      {/* 玻璃碎裂 */}
      {phase === 'shatter' && (
        <div className="os-shard-stage">
          {shards.map((s) => (
            <div
              key={s.key}
              className="os-shard"
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: `${s.w}%`,
                height: `${s.h}%`,
                clipPath: s.clipPath,
                animationDelay: s.delay,
                '--os-dx': s.dx,
                '--os-dy': s.dy,
                '--os-rot': s.rot,
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
