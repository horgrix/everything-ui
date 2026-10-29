import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useChartData from '../../hooks/useChartData';
import { querySqlV09 } from '../../api/query';
import { PC_GAME_TYPE_META } from '../TapTapReport/shared';
import { formatCompactNumber, formatNumber } from '../../utils/formatters';

/**
 * 搜索建议 SQL（dws_taptap_game）：仅数字前缀匹配（该接口不支持 LIKE，用 LEFT() 做前缀比较）。
 * 取最新月份快照，按 app_id 合并，带出游戏类型、图标与三级标签。
 */
function suggestSql(digits, month) {
  const t = 'dws_taptap_game';
  return `SELECT app_id,
      MAX(app_name) AS app_name,
      MAX(icon) AS icon,
      MAX(distribution_type) AS distribution_type,
      MAX(tag_1) AS tag_1, MAX(tag_2) AS tag_2, MAX(tag_3) AS tag_3
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

/** 两行榜单：下载榜 / 投放榜（各自再按 昨日 / 本周 / 本月 出 Top5） */
const RANK_SECTIONS = [
  {
    key: 'download',
    title: '下载榜',
    table: 'dws_taptap_download_rank',
    valueExpr: 'download_count',
    valueName: '下载',
    color: '#7A8B99',
  },
  {
    key: 'ad',
    title: '投放榜',
    table: 'dws_taptap_ad_aggr_v5_rank',
    valueExpr: '(ad_views + pcebid_views)',
    valueName: '投放',
    color: '#C4A4A4',
  },
];

/** 榜单周期：rank_type → 标题前缀 */
const RANK_PERIODS = [
  { key: 'daily', label: '昨日' },
  { key: 'weekly', label: '本周' },
  { key: 'monthly', label: '本月' },
];

/** 榜内数值展示：一律取整(均值也不带小数)；万以下用千分位，万以上用中文紧凑单位 */function fmtValue(v) {
  if (v == null || Number.isNaN(v)) return '-';
  const n = Math.round(v);
  if (Math.abs(n) < 1e4) return formatNumber(n, 0);
  return formatCompactNumber(n);
}

/**
 * 榜单 SQL：一次取三个周期（daily/weekly/monthly）各自最新快照的 Top5。
 * rank_type 对应的 crawled_at 精度不同：daily=YYYY-MM-DD、weekly=YYYY-WW、monthly=YYYY-MM。
 */
function rankSql(section) {
  const { table, valueExpr } = section;
  return `SELECT r.rank_type, r.crawled_at, r.app_id, r.app_name, r.icon, r.rank_no, ${valueExpr} AS val
    FROM ${table} r
    WHERE r.rank_type IN ('daily', 'weekly', 'monthly')
      AND r.rank_no <= 5
      AND r.crawled_at = (
        SELECT MAX(x.crawled_at) FROM ${table} x WHERE x.rank_type = r.rank_type
      )
    ORDER BY r.rank_type, r.rank_no`;
}

/** 榜单行转换：按周期（daily/weekly/monthly）分组，每组带该周期的快照标签 */
function toRankGroups(rows) {
  const groups = { daily: { snapshot: null, rows: [] }, weekly: { snapshot: null, rows: [] }, monthly: { snapshot: null, rows: [] } };
  (rows || []).forEach((r) => {
    const g = groups[r.rank_type];
    if (!g) return;
    g.snapshot = r.crawled_at;
    g.rows.push({
      appId: r.app_id,
      name: r.app_name != null ? String(r.app_name) : '-',
      icon: r.icon || '',
      rank: Number(r.rank_no),
      value: r.val == null ? null : Number(r.val),
    });
  });
  Object.values(groups).forEach((g) => g.rows.sort((a, b) => a.rank - b.rank));
  return groups;
}

/**
 * One Search：标题 + 搜索框 + 榜单；点击 Search 直接进入报表页，
 * 加载过场（0→100% + 玻璃碎裂）改由 SearchView 加载数据时播放。
 */
export default function OneSearch() {
  const [keyword, setKeyword] = useState('');
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [debounced, setDebounced] = useState('');
  const inputRef = useRef(null);
  const navigate = useNavigate();

  /* ===== 榜单（下载榜 / 投放榜，各自 昨日/本周/本月 的 Top5，v09） ===== */
  const month = useMemo(currentMonth, []);
  const downloadRankQuery = useChartData(
    'one-search-rank-download',
    () => querySqlV09(rankSql(RANK_SECTIONS[0])),
    {},
    { enabled: true, transform: toRankGroups, staleTime: 5 * 60 * 1000 },
  );
  const adRankQuery = useChartData(
    'one-search-rank-ad',
    () => querySqlV09(rankSql(RANK_SECTIONS[1])),
    {},
    { enabled: true, transform: toRankGroups, staleTime: 5 * 60 * 1000 },
  );
  const rankQueries = { download: downloadRankQuery, ad: adRankQuery };

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
          icon: r.icon || '',
          distributionType: r.distribution_type ?? null,
          tags: [r.tag_1, r.tag_2, r.tag_3].filter(Boolean),
        })),
    },
  );
  const suggestions = suggestQuery.data || [];
  const suggestLoading = suggestQuery.isFetching || debounced !== keyword.trim();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = (override) => {
    const value = String(override ?? keyword).trim();
    if (!value) return;
    navigate(`/one-search/report?q=${encodeURIComponent(value)}`);
  };

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

  const showSuggest = focused && keyword.trim().length > 0;

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
                  {/* 游戏类型 */}
                  {(() => {
                    const meta = PC_GAME_TYPE_META[s.distributionType];
                    if (!meta) return <span style={{ width: 62, flex: '0 0 auto' }} />;
                    return (
                      <span
                        className="badge"
                        style={{ backgroundColor: meta.color, color: '#fff', fontSize: 10.5, fontWeight: 500, width: 62, flex: '0 0 auto' }}
                      >
                        {meta.label}
                      </span>
                    );
                  })()}
                  {/* APPID */}
                  <span className="text-muted" style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', width: 62, flex: '0 0 auto' }}>
                    {s.appId}
                  </span>
                  {/* 游戏图标 + 名称 */}
                  <span className="d-flex align-items-center gap-2" style={{ minWidth: 0, flex: '1 1 auto' }}>
                    <span
                      className="d-flex align-items-center justify-content-center"
                      style={{ width: 20, height: 20, borderRadius: 4, background: '#F1F3F5', overflow: 'hidden', flex: '0 0 auto' }}
                    >
                      {s.icon && (
                        <img
                          src={s.icon}
                          alt=""
                          width={20}
                          height={20}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          style={{ objectFit: 'cover' }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                    </span>
                    <span className="text-truncate" style={{ fontSize: 14 }}>{s.name}</span>
                  </span>
                  {/* 标签 */}
                  <span className="d-none d-md-flex align-items-center gap-1" style={{ flex: '0 0 auto' }}>
                    {(s.tags || []).length === 0 && <span className="text-muted" style={{ fontSize: 11 }}>-</span>}
                    {(s.tags || []).map((tag, ti) => (
                      <span
                        key={`${tag}-${ti}`}
                        className="badge"
                        style={{ backgroundColor: ['#7A8B99', '#7D8F7B', '#B08B8B'][ti] || '#8A94A0', color: '#fff', fontSize: 10, fontWeight: 500 }}
                      >
                        {tag}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>

        {/* 榜单：两行（下载榜 / 投放榜），每行三列 昨日 / 本周 / 本月 Top5 */}
        <div
          className="position-absolute start-50 translate-middle-x"
          /* 紧贴 64px 高的搜索框下方（搜索框在 40vh） */
          style={{ top: 'calc(40vh + 70px)', width: '100%', maxWidth: 860, paddingLeft: 16, paddingRight: 16 }}
        >
          {RANK_SECTIONS.map((section) => {
            const q = rankQueries[section.key];
            const groups = q.data || {};
            return (
              <div key={section.key} className="d-flex flex-wrap gap-2 align-items-stretch mb-2">
                {RANK_PERIODS.map((period) => {
                  const g = groups[period.key] || { snapshot: null, rows: [] };
                  const rows = g.rows || [];
                  return (
                    <div key={period.key} className="card border-0 shadow-sm" style={{ flex: '1 1 0', minWidth: 0 }}>
                      <div className="card-body p-2 px-3">
                        <div className="d-flex justify-content-between align-items-baseline mb-1">
                          <span className="fw-semibold" style={{ fontSize: 13 }}>
                            【{section.title}】{period.label}Top5
                          </span>
                          <span className="text-muted" style={{ fontSize: 10.5 }}>{g.snapshot || ''}</span>
                        </div>

                        {q.isLoading && (
                          <div>
                            {[0, 1, 2, 3, 4].map((k) => (
                              <div key={k} style={{ height: 12, borderRadius: 3, background: '#F1F3F5', margin: '6px 0' }} />
                            ))}
                          </div>
                        )}

                        {!q.isLoading && rows.length === 0 && (
                          <div className="text-muted" style={{ fontSize: 12, padding: '14px 0', textAlign: 'center' }}>
                            暂无数据
                          </div>
                        )}

                        {!q.isLoading && rows.map((r) => (
                          <div
                            key={`${section.key}-${period.key}-${r.appId}`}
                            className="d-flex align-items-center gap-2"
                            role="button"
                            tabIndex={0}
                            onClick={() => { setKeyword(String(r.appId)); handleSearch(r.appId); }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') { setKeyword(String(r.appId)); handleSearch(r.appId); }
                            }}
                            title={`搜索 ${r.name}（${r.appId}）`}
                            style={{ padding: '1px 0', cursor: 'pointer', lineHeight: 1.5 }}
                          >
                            <span
                              className="d-flex align-items-center justify-content-center fw-semibold"
                              style={{
                                width: 17,
                                height: 17,
                                borderRadius: 4,
                                fontSize: 10.5,
                                flex: '0 0 auto',
                                background: r.rank <= 3 ? `${section.color}26` : '#F1F3F5',
                                color: r.rank <= 3 ? section.color : '#8A94A0',
                              }}
                            >
                              {r.rank}
                            </span>
                            <span
                              className="d-flex align-items-center justify-content-center"
                              style={{ width: 17, height: 17, borderRadius: 4, background: '#F1F3F5', overflow: 'hidden', flex: '0 0 auto' }}
                            >
                              {r.icon && (
                                <img
                                  src={r.icon}
                                  alt=""
                                  width={17}
                                  height={17}
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                  style={{ objectFit: 'cover' }}
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              )}
                            </span>
                            <span className="flex-grow-1 text-truncate" style={{ fontSize: 12, minWidth: 0 }}>{r.name}</span>
                            <span
                              className="fw-semibold text-nowrap"
                              style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', flex: '0 0 auto' }}
                              title={`${section.valueName}：${formatNumber(r.value, 0)}`}
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
            );
          })}
        </div>
      </div>

    </>
  );
}
