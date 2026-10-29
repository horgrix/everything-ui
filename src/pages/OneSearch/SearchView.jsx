import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import useChartData from '../../hooks/useChartData';
import { querySqlV09 } from '../../api/query';
import BrushLineChart from '../../components/charts/BrushLineChart';
import DashboardCard from '../../components/layout/DashboardCard';
import { PC_GAME_TYPE_META } from '../TapTapReport/shared';
import { formatCompactNumber, formatNumber } from '../../utils/formatters';
import SearchLoadingOverlay from './SearchLoadingOverlay';


/** 头像底色（取自色库） */
const AVATAR_COLORS = [
  '#7A8B99', '#9CAF9F', '#C4A4A4', '#D6C9B0', '#9B93A8',
  '#8FA3B0', '#7D8F7B', '#D0B4B4', '#BFAE8E', '#B4AEC0',
];

/** 由 app_id 稳定地映射一个头像底色 */
function avatarColor(appId) {
  const s = String(appId ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** 游戏头像：优先用表里的 icon，为空或加载失败时回退到「首字 + 纯色块」 */
function GameAvatar({ appId, name, icon, size = 60 }) {
  const [failed, setFailed] = useState(false);
  const boxStyle = { width: size, height: size, flexShrink: 0, borderRadius: 12, overflow: 'hidden' };

  if (icon && !failed) {
    return (
      <img
        src={icon}
        alt={name ? `${name} 图标` : ''}
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        style={{ ...boxStyle, objectFit: 'cover', background: '#F1F3F5' }}
      />
    );
  }

  return (
    <div
      className="d-flex align-items-center justify-content-center fw-bold text-white"
      style={{ ...boxStyle, fontSize: Math.round(size * 0.43), backgroundColor: avatarColor(appId) }}
      aria-hidden="true"
    >
      {String(name || '?').trim().charAt(0)}
    </div>
  );
}

/** 标签底色（与其它页面一致） */
const TAG_COLORS = ['#7A8B99', '#7D8F7B', '#B08B8B'];

/** 下载排名卡的三个周期（日 / 周 / 月）及其徽标底色 */
const RANK_PERIODS = [
  { key: 'daily', label: '日榜', color: '#7A8B99' },
  { key: 'weekly', label: '周榜', color: '#8FA3B0' },
  { key: 'monthly', label: '月榜', color: '#C4A4A4' },
];

/** 下载趋势的系列定义 */
const DOWNLOAD_SERIES = [
  { name: '总下载数', field: 'download_count', color: '#7A8B99' },
  { name: 'PC端下载数', field: 'pc_download_count', color: '#9CAF9F' },
  { name: '移动端下载数', field: 'app_download_count', color: '#C4A4A4' },
];

/** APP首页广告投放趋势系列（v5 表的 app 渠道：广告 / 资源互换） */
const LANDING_AD_SERIES = [
  { name: '首页广告', field: 'ad_views', color: '#8FA3B0' },
  { name: '资源互换', field: 'pcebid_views', color: '#9B93A8' },
];

/** APP搜索页关键词广告投放趋势系列（v5 表的 kw 渠道：广告 / 资源互换） */
const KEYWORD_AD_SERIES = [
  { name: '关键词广告', field: 'ad_views', color: '#9CAF9F' },
  { name: '资源互换', field: 'pcebid_views', color: '#C4A4A4' },
];

/** PC首页广告投放趋势系列（v5 表的 pc 渠道：广告 / 资源互换） */
const PC_AD_SERIES = [
  { name: 'PC广告', field: 'ad_views', color: '#8FA3B0' },
  { name: '资源互换', field: 'pcebid_views', color: '#C9B79C' },
];

/** 广告投放趋势 Tab 配置 */
const AD_TREND_TABS = [
  { key: 'landing', label: 'APP首页广告投放趋势' },
  { key: 'keyword', label: 'APP搜索页关键词广告投放趋势' },
  { key: 'pc', label: 'PC首页广告投放趋势' },
];

/** 日期字符串 → 毫秒（日期级） */
const DATE_X = (d) => new Date(`${String(d).slice(0, 10)}T00:00:00`).getTime();

/** 日期字符串 → 毫秒（小时级，如 '2026-10-16 08'） */
const HOUR_X = (d) => {
  const s = String(d);
  const datePart = s.slice(0, 10);
  const hh = String(s.slice(11, 13) || '0').padStart(2, '0');
  return new Date(`${datePart}T${hh}:00:00`).getTime();
};

/** 把「日期 + 多指标」行转成 BrushLineChart 的 series + 默认刷选（最近 keepLast 条） */
function buildBrushSeries(rows, defs, keepLast, xOf = DATE_X) {
  if (!rows || rows.length === 0) return { series: [], selection: null };
  const num = (v) => (v == null ? null : Number(v));
  const sorted = [...rows].sort((a, b) => (a.crawled_at < b.crawled_at ? -1 : 1));
  const n = sorted.length;
  const startIdx = Math.max(0, n - keepLast);
  return {
    series: defs.map((s) => ({
      name: s.name,
      data: sorted.map((r) => ({ x: xOf(r.crawled_at), y: num(r[s.field]) })),
    })),
    selection: { min: xOf(sorted[startIdx].crawled_at), max: xOf(sorted[n - 1].crawled_at) },
  };
}

/** 本月（YYYY-MM） */
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 指定月份的起止边界（起含、止不含）；startHour 供小时级表，startDate 供日期级表 */
function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const endDate = `${ny}-${String(nm).padStart(2, '0')}-01`;
  return { startHour: `${ym}-01 00`, startDate: `${ym}-01`, endDate };
}

/** 本年（起含、止不含） */
function yearRange() {
  const y = new Date().getFullYear();
  return { start: `${y}-01-01`, end: `${y + 1}-01-01` };
}

/** 【游戏基本信息】简洁卡片 */
function GameInfoCard({ game, ranks = [] }) {
  const name = String(game.appName || '未知');
  const tags = [game.tag1, game.tag2, game.tag3].filter(Boolean);
  const typeMeta = PC_GAME_TYPE_META[game.distributionType];

  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body">
        <div className="d-flex gap-3 align-items-start">
          <GameAvatar appId={game.appId} name={name} icon={game.icon} />

          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            {/* 游戏名称 + 游戏类型（紧跟在名称后） */}
            <div className="d-flex align-items-center gap-2 mb-1" style={{ minWidth: 0 }}>
              <span className="fw-semibold text-truncate" style={{ fontSize: 17 }} title={name}>
                {name}
              </span>
              {typeMeta && (
                <span className="badge flex-shrink-0" style={{ backgroundColor: typeMeta.color, color: '#fff' }}>
                  {typeMeta.label}
                </span>
              )}
            </div>

            <a
              href={`https://www.taptap.cn/app/${game.appId}`}
              target="_blank"
              rel="noreferrer"
              className="small text-decoration-none text-primary"
              title={`打开 TapTap 页面：${game.appId}`}
            >
              APPID {game.appId}
              <i className="bi bi-box-arrow-up-right ms-1" style={{ fontSize: 10 }}></i>
            </a>

            <div className="d-flex flex-wrap gap-1 mt-2">
              {tags.map((t, i) => (
                <span key={`${t}-${i}`} className="badge" style={{ backgroundColor: TAG_COLORS[i % TAG_COLORS.length], color: '#fff' }}>
                  {t}
                </span>
              ))}
              {!tags.length && <span className="text-muted small">-</span>}
            </div>
          </div>
        </div>

        {/* 排名：数字 + 底色（图标风格） */}
        {ranks.length > 0 && (
          <div className="d-flex flex-wrap gap-3 mt-3 pt-3 border-top">
            {ranks.map((r) => (
              <div key={r.label} className="d-flex align-items-center gap-2" style={{ minWidth: 0 }} title={`${r.fullLabel || r.label}：第 ${r.rank ?? '-'} 名`}>
                <span
                  className="rounded-3 d-inline-flex align-items-center justify-content-center fw-bold text-white flex-shrink-0"
                  style={{ minWidth: 30, height: 30, padding: '0 5px', fontSize: 13, lineHeight: 1, backgroundColor: r.color }}
                >
                  {r.rank != null ? r.rank : '-'}
                </span>
                <span className="text-muted" style={{ fontSize: 11, lineHeight: 1.25 }}>
                  {r.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** 排名徽标行：日 / 周 / 月 三块「底色数字 + 小标签」（与游戏基本信息卡的排名块同款） */
function RankBadgeRow({ ranks, rankField, valueField, valueLabel = '下载' }) {
  return (
    <div className="d-flex flex-wrap gap-3 mt-2 pt-2 border-top">
      {RANK_PERIODS.map((p) => {
        const row = ranks?.[p.key] ?? null;
        const rank = row ? row[rankField] : null;
        const val = row ? row[valueField] : null;
        const tip = `${p.label}：第 ${rank != null ? rank : '-'} 名${val != null ? ` · ${valueLabel} ${formatNumber(val)}` : ''}`;
        return (
          <div key={p.key} className="d-flex align-items-center gap-2" style={{ minWidth: 0 }} title={tip}>
            <span
              className="rounded-3 d-inline-flex align-items-center justify-content-center fw-bold text-white flex-shrink-0"
              style={{ minWidth: 30, height: 30, padding: '0 5px', fontSize: 13, lineHeight: 1, backgroundColor: p.color }}
            >
              {rank != null ? rank : '-'}
            </span>
            <span className="text-muted" style={{ fontSize: 11, lineHeight: 1.25 }}>
              {p.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** 带排名图标块的统计卡：排名块（数字 + 底色） + 数值 + 统计时间 */
function RankedStatCard({ title, value, subtitle, rank, rankLabel, color = '#8FA3B0', extra = null, icon = null, rankRow = null }) {
  // 传了 icon 时左侧色块显示图标，排名并入副标题（信息不丢失）
  const rankText = rank != null ? `${rankLabel || '排名'} 第 ${rank} 名` : null;
  const subText = [subtitle, icon ? rankText : null].filter(Boolean).join(' · ');

  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body">
        <p className="text-muted small mb-1">{title}</p>
        <div className="d-flex align-items-center gap-2 mb-1">
          {icon ? (
            <span
              className="rounded-3 d-inline-flex align-items-center justify-content-center text-white flex-shrink-0"
              style={{ width: 32, height: 32, backgroundColor: color }}
              title={rankText || undefined}
            >
              <i className={`bi ${icon}`} style={{ fontSize: 16 }}></i>
            </span>
          ) : rank != null ? (
            <span
              className="rounded-3 d-inline-flex align-items-center justify-content-center fw-bold text-white flex-shrink-0"
              style={{ minWidth: 32, height: 32, padding: '0 6px', fontSize: 13, lineHeight: 1, backgroundColor: color }}
              title={`${rankLabel}：第 ${rank} 名`}
            >
              {rank}
            </span>
          ) : null}
          <div className="fw-bold" style={{ fontSize: 22, lineHeight: 1.2 }}>
            {value}
          </div>
        </div>
        {extra ? <div className="mb-2">{extra}</div> : null}
        {subText && <small className="text-muted">{subText}</small>}
        {rankRow}
      </div>
    </div>
  );
}

/** 昨天日期，'YYYY-MM-DD' */
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 概览周期：昨日 / 本周 / 本月 → 活跃游戏统计的 period_type */
const OVERVIEW_PERIODS = [
  { key: 'daily', label: '昨日' },
  { key: 'weekly', label: '本周' },
  { key: 'monthly', label: '本月' },
];

/**
 * 整体数据概览（dws_taptap_active_game_stat）：各周期内有下载 / 有投放记录的游戏数
 */
function DataOverviewPanel({ data }) {
  const groups = [
    { key: 'download', title: '下载概览：有下载数据游戏数量', field: 'download', icon: 'bi-download', color: '#7D8F7B' },
    { key: 'ad', title: '投放概览：有投放统计游戏数量', field: 'ad', icon: 'bi-bullseye', color: '#BFAE8E' },
  ];

  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body d-flex flex-column">
        <div className="d-flex align-items-center gap-2 mb-3">
          <span
            className="rounded-3 d-inline-flex align-items-center justify-content-center text-white flex-shrink-0"
            style={{ width: 38, height: 38, backgroundColor: '#9B93A8' }}
          >
            <i className="bi bi-bar-chart-line" style={{ fontSize: 18 }}></i>
          </span>
          <div>
            <div className="fw-semibold" style={{ fontSize: 15 }}>
              整体数据概览
            </div>
            <div className="text-muted" style={{ fontSize: 11 }}>
              各周期内有记录的游戏数
            </div>
          </div>
        </div>

        {groups.map((g, gi) => (
          <div key={g.key} className={gi === groups.length - 1 ? '' : 'mb-3'}>
            <div className="d-flex align-items-center gap-2 mb-2">
              <span
                className="rounded-2 d-inline-flex align-items-center justify-content-center text-white flex-shrink-0"
                style={{ width: 20, height: 20, backgroundColor: g.color }}
              >
                <i className={`bi ${g.icon}`} style={{ fontSize: 11 }}></i>
              </span>
              <span className="fw-semibold" style={{ fontSize: 12 }}>
                {g.title}
              </span>
            </div>
            <div className="row g-2">
              {OVERVIEW_PERIODS.map((p) => {
                const value = data?.[p.key]?.[g.field];
                return (
                  <div className="col-4" key={p.key}>
                    <div className="rounded-3 px-2 py-2 text-center" style={{ background: '#F5F7F9' }}>
                      <div className="text-muted" style={{ fontSize: 11, lineHeight: 1.4 }}>
                        {p.label}
                      </div>
                      <div className="fw-bold" style={{ fontSize: 18, lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }}>
                        {value != null ? formatNumber(value) : '-'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 数据口径说明面板（放在「游戏基本信息」卡片右侧） */
function DataNotePanel() {
  const cutoff = yesterdayStr();
  const notes = { daily: '代表昨日', weekly: '代表本周截至昨日', monthly: '代表本月截至昨日' };

  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body">
        {/* 数据截至日 */}
        <div className="d-flex align-items-center gap-3 mb-3">
          <span
            className="rounded-3 d-inline-flex align-items-center justify-content-center text-white flex-shrink-0"
            style={{ width: 38, height: 38, backgroundColor: '#7A8B99' }}
          >
            <i className="bi bi-calendar-check" style={{ fontSize: 18 }}></i>
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="text-muted" style={{ fontSize: 12 }}>
              数据截至日
            </div>
            <div className="fw-bold" style={{ fontSize: 20, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
              {cutoff}
            </div>
          </div>
        </div>

        {/* 数据说明 */}
        <div
          className="d-flex align-items-start gap-2 rounded-3 px-2 py-2 mb-3"
          style={{ background: '#F5F7F9', color: '#6C757D', fontSize: 12, lineHeight: 1.6 }}
        >
          <i className="bi bi-info-circle mt-1 flex-shrink-0"></i>
          <span>本页面是离线计算数据，不包含今日最新的实时数据</span>
        </div>

        {/* 榜单口径 */}
        <div className="d-flex flex-column gap-2 pt-3 border-top">
          {RANK_PERIODS.map((p) => (
            <div key={p.key} className="d-flex align-items-center gap-2">
              <span
                className="badge rounded-3 flex-shrink-0 fw-semibold"
                style={{ backgroundColor: p.color, color: '#fff', minWidth: 44, fontSize: 11, padding: '4px 6px' }}
              >
                {p.label}
              </span>
              <span className="text-muted" style={{ fontSize: 12 }}>
                {notes[p.key]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 脚印图形（指向右） */
function FootSvg() {
  return (
    <svg viewBox="0 0 36 24" fill="currentColor" width="100%" height="100%" aria-hidden="true">
      <ellipse cx="13" cy="12" rx="11.5" ry="7.2" />
      <circle cx="27.4" cy="6.4" r="3.1" />
      <circle cx="30.4" cy="12.4" r="3.4" />
      <circle cx="27.6" cy="18" r="2.8" />
    </svg>
  );
}

/** 脚印从左到右循环走过（5s 一个循环，交错延迟形成连续的足迹）；中间带放大镜 + ?! 装饰 */
function FootprintTrail({ count = 6 }) {
  return (
    <div className="os-foot-stage" aria-hidden="true">
      <div className="os-foot-center">
        <i className="bi bi-search"></i>
        <span className="os-foot-mark">?!</span>
      </div>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="os-foot"
          style={{
            animationDelay: `-${((5 / count) * i).toFixed(2)}s`,
            top: `calc(50% ${i % 2 === 0 ? '-' : '+'} 13px)`,
          }}
        >
          <FootSvg />
        </span>
      ))}
    </div>
  );
}

/**
 * SearchView：One Search 检索结果页
 * - 【游戏基本信息】：按 APPID 精确匹配 dws_taptap_game（走 v09 SQL 接口），优先本月快照，缺失时取该表最新月份
 * - 【游戏下载趋势】：该 APPID 本年的下载趋势，Brush 默认选中最近15条
 */
export default function SearchView() {
  const [params] = useSearchParams();
  const keyword = (params.get('q') || '').trim();
  const [adTrendTab, setAdTrendTab] = useState('landing');
  const isAppId = /^\d+$/.test(keyword);
  const appId = isAppId ? Number(keyword) : null;
  const month = currentMonth();

  const infoQuery = useChartData(
    `one-search-info-game-${keyword}-${month}`,
    () =>
      querySqlV09(
        `SELECT app_id, app_name, icon, tag_1, tag_2, tag_3, distribution_type
         FROM dws_taptap_game
         WHERE app_id = ${appId}
           AND crawled_at = COALESCE(
             (SELECT MAX(crawled_at) FROM dws_taptap_game WHERE crawled_at = '${month}'),
             (SELECT MAX(crawled_at) FROM dws_taptap_game)
           )`
      ),
    {},
    {
      enabled: !!appId,
      transform: (rows) =>
        (rows || []).map((r) => ({
          appId: r.app_id,
          appName: r.app_name,
          icon: r.icon || '',
          tag1: r.tag_1,
          tag2: r.tag_2,
          tag3: r.tag_3,
          distributionType: r.distribution_type,
        })),
    }
  );

  const games = infoQuery.data || [];
  const targetApp = games[0] || (appId ? { appId, appName: '' } : null);

  // 【在线人数】本月最大/平均在线（按小时汇总各来源后再统计）
  const range = monthRange(month);
  const thisYear = yearRange();
  const peakQuery = useChartData(
    `one-search-peak-${keyword}-${month}`,
    () =>
      querySqlV09(
        `SELECT crawled_at, SUM(online_players) AS players
         FROM dws_taptap_pc_online_peak_players_rank_hourly
         WHERE app_id = ${appId}
           AND crawled_at >= '${range.startHour}' AND crawled_at < '${range.endDate}'
         GROUP BY crawled_at
         ORDER BY crawled_at ASC`
      ),
    {},
    {
      enabled: !!appId,
      transform: (rows) => {
        if (!rows || rows.length === 0) return null;
        let maxVal = null;
        let maxAt = null;
        let sum = 0;
        let cnt = 0;
        for (const r of rows) {
          const v = r.players == null ? null : Number(r.players);
          if (v == null || Number.isNaN(v)) continue;
          sum += v;
          cnt += 1;
          if (maxVal == null || v > maxVal) {
            maxVal = v;
            maxAt = r.crawled_at;
          }
        }
        if (!cnt) return null;
        return {
          maxVal,
          maxAt,
          avgVal: Math.round(sum / cnt),
          firstAt: rows[0].crawled_at,
          lastAt: rows[rows.length - 1].crawled_at,
          cnt,
        };
      },
    }
  );
  const peak = peakQuery.data;

  // 【整体数据概览】dws_taptap_active_game_stat：日/周/月各自最新快照的「有下载 / 有投放」游戏数
  const activeStatQuery = useChartData(
    'one-search-active-game-stat',
    () =>
      querySqlV09(
        `SELECT r.period_type, r.crawled_at, r.ad_app_cnt, r.download_app_cnt
         FROM dws_taptap_active_game_stat r
         WHERE r.period_type IN ('daily', 'weekly', 'monthly')
           AND r.crawled_at = (
             SELECT MAX(x.crawled_at) FROM dws_taptap_active_game_stat x WHERE x.period_type = r.period_type
           )`
      ),
    {},
    {
      enabled: true,
      staleTime: 5 * 60 * 1000,
      transform: (rows) => {
        if (!rows || rows.length === 0) return null;
        const out = {};
        for (const r of rows) {
          out[r.period_type] = {
            snapshot: r.crawled_at,
            download: r.download_app_cnt == null ? null : Number(r.download_app_cnt),
            ad: r.ad_app_cnt == null ? null : Number(r.ad_app_cnt),
          };
        }
        return Object.keys(out).length ? out : null;
      },
    }
  );

  // 【下载量 / 下载排名】dws_taptap_download_rank：一次取 日 / 周 / 月 三个周期的最新快照
  // 该表 crawled_at 精度随 rank_type 变化：daily=YYYY-MM-DD、weekly=YYYY-WW、monthly=YYYY-MM
  const downloadRankQuery = useChartData(
    `one-search-download-rank-${appId ?? 'none'}`,
    () =>
      querySqlV09(
        `SELECT r.rank_type, r.crawled_at, r.download_count, r.app_download_count, r.pc_download_count,
                r.avg_download, r.rank_no, r.rank_app, r.rank_pc, r.rank_avg
         FROM dws_taptap_download_rank r
         WHERE r.app_id = ${appId}
           AND r.rank_type IN ('daily', 'weekly', 'monthly')
           AND r.crawled_at = (
             SELECT MAX(x.crawled_at) FROM dws_taptap_download_rank x WHERE x.rank_type = r.rank_type
           )`
      ),
    {},
    {
      enabled: !!appId,
      transform: (rows) => {
        if (!rows || rows.length === 0) return null;
        const n = (v) => (v == null ? null : Number(v));
        const out = {};
        for (const r of rows) {
          out[r.rank_type] = {
            snapshot: r.crawled_at,
            total: n(r.download_count),
            mobile: n(r.app_download_count),
            pc: n(r.pc_download_count),
            avg: r.avg_download == null ? null : Math.round(Number(r.avg_download)),
            rankTotal: n(r.rank_no),
            rankMobile: n(r.rank_app),
            rankPc: n(r.rank_pc),
            rankAvg: n(r.rank_avg),
          };
        }
        return Object.keys(out).length ? out : null;
      },
    }
  );
  const downloadRanks = downloadRankQuery.data;
  const downloadMonth = downloadRanks?.monthly ?? null;
  const downloadKpiSubtitle = downloadMonth
    ? `本月快照 ${downloadMonth.snapshot}`
    : downloadRankQuery.isLoading
      ? '加载中…'
      : '本月暂无数据';

  // 【广告】总投放次数 / APP首页 / APP搜索页关键词 / PC首页（dws_taptap_ad_aggr_v5_rank，带日/周/月排名）
  // 该表每行已含各渠道合计（total_views / app_total / kw_total / pc_total）与名次（rank_no / rank_app / rank_kw / rank_pc）
  const adKpiRankQuery = useChartData(
    `one-search-ad-aggr-v5-rank-${appId ?? 'none'}`,
    () =>
      querySqlV09(
        `SELECT r.rank_type, r.crawled_at, r.total_views, r.app_total, r.kw_total, r.pc_total,
                r.rank_no, r.rank_app, r.rank_kw, r.rank_pc
         FROM dws_taptap_ad_aggr_v5_rank r
         WHERE r.app_id = ${appId}
           AND r.rank_type IN ('daily', 'weekly', 'monthly')
           AND r.crawled_at = (
             SELECT MAX(x.crawled_at) FROM dws_taptap_ad_aggr_v5_rank x WHERE x.rank_type = r.rank_type
           )`
      ),
    {},
    {
      enabled: !!appId,
      transform: (rows) => {
        if (!rows || rows.length === 0) return null;
        const n = (v) => (v == null ? null : Number(v));
        const out = {};
        for (const r of rows) {
          out[r.rank_type] = {
            snapshot: r.crawled_at,
            total: n(r.total_views),
            appHome: n(r.app_total),
            appKeyword: n(r.kw_total),
            pcHome: n(r.pc_total),
            rankTotal: n(r.rank_no),
            rankApp: n(r.rank_app),
            rankKw: n(r.rank_kw),
            rankPc: n(r.rank_pc),
          };
        }
        return Object.keys(out).length ? out : null;
      },
    }
  );
  const adRanks = adKpiRankQuery.data;
  const adMonth = adRanks?.monthly ?? null;
  const adKpiSubtitle = adMonth
    ? `本月快照 ${adMonth.snapshot}`
    : adKpiRankQuery.isLoading
      ? '加载中…'
      : '本月暂无数据';

  // 【在线人数排名】本月峰值/均值排名
  const onlineRankQuery = useChartData(
    `one-search-online-rank-${appId ?? 'none'}-${month}`,
    () =>
      querySqlV09(
        `SELECT peak_online_players, peak_rank, avg_online_players, avg_rank, stat_hours, crawled_at
         FROM dws_taptap_pc_online_peak_players_rank_monthly
         WHERE app_id = ${appId} AND crawled_at = '${month}'`
      ),
    {},
    {
      enabled: !!appId,
      transform: (rows) => {
        if (!rows || rows.length === 0) return null;
        const n = (v) => (v == null ? null : Number(v));
        const r = rows[0];
        return {
          peakRank: n(r.peak_rank),
          peakPlayers: n(r.peak_online_players),
          avgRank: n(r.avg_rank),
          avgPlayers: r.avg_online_players == null ? null : Math.round(Number(r.avg_online_players)),
          month: r.crawled_at,
        };
      },
    }
  );
  const onlineRank = onlineRankQuery.data;

  // 【APP首页广告投放趋势】本年，按 app_id（dws_taptap_ad_aggr_v5_daily 的 APP 首页渠道）
  const landingTrendQuery = useChartData(
    `one-search-landing-trend-v5-${appId ?? 'none'}-${thisYear.start}`,
    () =>
      querySqlV09(
        `SELECT crawled_at,
                COALESCE(app_ad_views, 0) AS ad_views,
                COALESCE(app_pcebid_views, 0) AS pcebid_views
         FROM dws_taptap_ad_aggr_v5_daily
         WHERE app_id = ${appId}
           AND crawled_at >= '${thisYear.start}' AND crawled_at < '${thisYear.end}'
         ORDER BY crawled_at ASC`
      ),
    {},
    { enabled: !!appId, transform: (rows) => buildBrushSeries(rows, LANDING_AD_SERIES, 7) }
  );

  // 【APP搜索页关键词广告投放趋势】本年，按 app_id（v5 表的 APP 搜索页关键词渠道）
  const keywordTrendQuery = useChartData(
    `one-search-keyword-trend-v5-${appId ?? 'none'}-${thisYear.start}`,
    () =>
      querySqlV09(
        `SELECT crawled_at,
                COALESCE(kw_ad_views, 0) AS ad_views,
                COALESCE(kw_pcebid_views, 0) AS pcebid_views
         FROM dws_taptap_ad_aggr_v5_daily
         WHERE app_id = ${appId}
           AND crawled_at >= '${thisYear.start}' AND crawled_at < '${thisYear.end}'
         ORDER BY crawled_at ASC`
      ),
    {},
    { enabled: !!appId, transform: (rows) => buildBrushSeries(rows, KEYWORD_AD_SERIES, 7) }
  );

  // 【PC首页广告投放趋势】本年，按 app_id（v5 表的 PC 首页渠道）
  const pcAdTrendQuery = useChartData(
    `one-search-pc-ad-trend-v5-${appId ?? 'none'}-${thisYear.start}`,
    () =>
      querySqlV09(
        `SELECT crawled_at,
                COALESCE(pc_ad_views, 0) AS ad_views,
                COALESCE(pc_pcebid_views, 0) AS pcebid_views
         FROM dws_taptap_ad_aggr_v5_daily
         WHERE app_id = ${appId}
           AND crawled_at >= '${thisYear.start}' AND crawled_at < '${thisYear.end}'
         ORDER BY crawled_at ASC`
      ),
    {},
    { enabled: !!appId, transform: (rows) => buildBrushSeries(rows, PC_AD_SERIES, 7) }
  );

  const downloadQuery = useChartData(
    `one-search-download-${appId ?? 'none'}`,
    () =>
      querySqlV09(
        `SELECT crawled_at, download_count, pc_download_count, app_download_count
         FROM dws_taptap_download_daily
         WHERE app_id = ${appId}
           AND crawled_at >= '${thisYear.start}' AND crawled_at < '${thisYear.end}'
         ORDER BY crawled_at ASC`
      ),
    {},
    {
      enabled: !!appId,
      transform: (dataRows) => {
        if (!dataRows || dataRows.length === 0) return { series: [], selection: null };
        const num = (v) => (v == null ? null : Number(v));
        const toX = (d) => new Date(`${String(d).slice(0, 10)}T00:00:00`).getTime();
        const sorted = [...dataRows].sort((a, b) => (a.crawled_at < b.crawled_at ? -1 : 1));
        const n = sorted.length;
        // 刷选默认只选中最近 15 条数据
        const startIdx = Math.max(0, n - 15);
        return {
          series: DOWNLOAD_SERIES.map((s) => ({
            name: s.name,
            data: sorted.map((r) => ({ x: toX(r.crawled_at), y: num(r[s.field]) })),
          })),
          selection: { min: toX(sorted[startIdx].crawled_at), max: toX(sorted[n - 1].crawled_at) },
        };
      },
    }
  );

  // 【峰值人数在线趋势】本月，按 app_id（同小时多来源先求和）
  const onlineTrendQuery = useChartData(
    `one-search-online-trend-${appId ?? 'none'}-${month}`,
    () =>
      querySqlV09(
        `SELECT crawled_at, SUM(online_players) AS players
         FROM dws_taptap_pc_online_peak_players_rank_hourly
         WHERE app_id = ${appId}
           AND crawled_at >= '${range.startHour}' AND crawled_at < '${range.endDate}'
         GROUP BY crawled_at
         ORDER BY crawled_at ASC`
      ),
    {},
    {
      enabled: !!appId,
      transform: (rows) => buildBrushSeries(rows, [{ name: '在线人数', field: 'players', color: '#7A8B99' }], 24, HOUR_X),
    }
  );

  // 【加载过场】首屏四块数据（基本信息 / 在线人数 / 下载卡 / 广告卡）就绪进度，
  // 进入页面时播放 0→100% + 玻璃碎裂动画，数据齐了自动收起
  const bootQueries = [infoQuery, peakQuery, downloadRankQuery, adKpiRankQuery, activeStatQuery];
  const bootDone = bootQueries.filter((q) => !q.isLoading).length;
  const bootReady = bootDone === bootQueries.length;

  return (
    <div className="container-fluid p-4">
      <SearchLoadingOverlay
        progress={bootDone / bootQueries.length}
        ready={bootReady}
        label={`正在检索「${keyword || '—'}」的数据…`}
      />
      <h2 className="fw-bold mb-1">
        <i className="bi bi-search text-primary me-2"></i>
        游戏线索查询
      </h2>
      <div className="text-muted small mb-4">关键词：{keyword || '（空）'}</div>

      {/* 【游戏基本信息】 */}
      <div className="mb-4">
        <div className="fw-semibold mb-1">【游戏基本信息】</div>
        <div className="text-muted small mb-3">
          {appId ? `APPID ${appId} · 数据月份 ${month}` : '按 APPID 精确匹配'}
        </div>

        {games.length ? (
          <div className="row g-3">
            {games.map((g) => (
              <div className="col-12 col-md-6 col-xl-4" key={g.appId}>
                <GameInfoCard
                  game={g}
                  ranks={[
                    { label: '月榜：总下载', fullLabel: '总下载排名（月榜）', rank: downloadMonth ? downloadMonth.rankTotal : null, color: '#7A8B99' },
                    { label: '月榜：峰值在线', fullLabel: '峰值在线排名（月榜）', rank: onlineRank ? onlineRank.peakRank : null, color: '#8FA3B0' },
                    { label: '月榜：总投放次数', fullLabel: '总投放次数排名（月榜）', rank: adMonth ? adMonth.rankTotal : null, color: '#C9B79C' },
                  ]}
                />
              </div>
            ))}
            <div className="col-12 col-md-6 col-xl-4">
              <DataOverviewPanel data={activeStatQuery.data} />
            </div>
            <div className="col-12 col-md-6 col-xl-4">
              <DataNotePanel />
            </div>
            {/* 装饰：脚印 + 放大镜，居中一小条（原占满右侧空白，现让位给说明面板） */}
            <div className="col-12 d-none d-xl-flex justify-content-center">
              <div style={{ width: 360, height: 90 }}>
                <FootprintTrail />
              </div>
            </div>
          </div>
        ) : (
          <div className="card border-0 shadow-sm">
            <div className="card-body text-center text-muted py-5">
              <i className="bi bi-inbox fs-1 d-block mb-2"></i>
              {infoQuery.isLoading
                ? '加载中…'
                : !isAppId
                  ? '请输入 APPID（仅支持按 APPID 精确匹配）'
                  : '本月未找到该 APPID 的游戏信息'}
            </div>
          </div>
        )}
      </div>

      {/* 【在线人数】最大 / 平均（平均带均值排名图标） */}
      {appId && (
        <div className="row g-3 mb-4">
          <div className="col-12 col-md-6">
            <DashboardCard
              title="最大在线人数"
              value={peak ? formatNumber(peak.maxVal) : '-'}
              subtitle={peak && peak.maxAt ? `统计时间 ${peak.maxAt}` : peakQuery.isLoading ? '加载中…' : '本月暂无数据'}
              icon="bi-people"
              color="primary"
            />
          </div>
          <div className="col-12 col-md-6">
            <RankedStatCard
              title="平均在线人数"
              value={peak ? formatNumber(peak.avgVal) : '-'}
              subtitle={
                peak
                  ? `统计时间 ${peak.firstAt} ~ ${peak.lastAt}（${peak.cnt} 个采样点）`
                  : peakQuery.isLoading
                    ? '加载中…'
                    : '本月暂无数据'
              }
              rank={onlineRank ? onlineRank.avgRank : null}
              rankLabel="均值在线排名"
              color="#9B93A8"
              icon="bi-people"
            />
          </div>
        </div>
      )}

      {/* 【下载量】总下载量 / 日均下载量 / 移动端下载量 / PC端下载量（dws_taptap_download_rank，带日/周/月排名） */}
      {appId && (
        <div className="row g-3 mb-4">
          <div className="col-12 col-sm-6 col-xl-3">
            <RankedStatCard
              title="总下载量"
              value={downloadMonth ? formatNumber(downloadMonth.total) : '-'}
              subtitle={downloadKpiSubtitle}
              icon="bi-download"
              color="#7D8F7B"
              rankRow={<RankBadgeRow ranks={downloadRanks} rankField="rankTotal" valueField="total" />}
            />
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            <RankedStatCard
              title="日均下载量"
              value={downloadMonth ? formatNumber(downloadMonth.avg) : '-'}
              subtitle={downloadKpiSubtitle}
              icon="bi-download"
              color="#BFAE8E"
              rankRow={
                <RankBadgeRow ranks={downloadRanks} rankField="rankAvg" valueField="avg" valueLabel="日均" />
              }
            />
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            <RankedStatCard
              title="移动端下载量"
              value={downloadMonth ? formatNumber(downloadMonth.mobile) : '-'}
              subtitle={downloadKpiSubtitle}
              icon="bi-phone"
              color="#8FA3B0"
              rankRow={<RankBadgeRow ranks={downloadRanks} rankField="rankMobile" valueField="mobile" />}
            />
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            <RankedStatCard
              title="PC端下载量"
              value={downloadMonth ? formatNumber(downloadMonth.pc) : '-'}
              subtitle={downloadKpiSubtitle}
              icon="bi-pc"
              color="#9B93A8"
              rankRow={<RankBadgeRow ranks={downloadRanks} rankField="rankPc" valueField="pc" />}
            />
          </div>
        </div>
      )}

      {/* 【广告】总投放次数 / APP首页 / APP搜索页关键词 / PC首页（dws_taptap_ad_aggr_v5_rank，带日/周/月排名） */}
      {appId && (
        <div className="row g-3 mb-4">
          <div className="col-12 col-sm-6 col-xl-3">
            <RankedStatCard
              title="总投放次数"
              value={adMonth ? formatNumber(adMonth.total) : '-'}
              subtitle={adKpiSubtitle}
              icon="bi-bullseye"
              color="#7A8B99"
              rankRow={<RankBadgeRow ranks={adRanks} rankField="rankTotal" valueField="total" valueLabel="投放" />}
            />
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            <RankedStatCard
              title="APP首页广告统计次数"
              value={adMonth ? formatNumber(adMonth.appHome) : '-'}
              subtitle={adKpiSubtitle}
              icon="bi-phone"
              color="#7D8F7B"
              rankRow={<RankBadgeRow ranks={adRanks} rankField="rankApp" valueField="appHome" valueLabel="投放" />}
            />
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            <RankedStatCard
              title="APP搜索页关键词广告统计次数"
              value={adMonth ? formatNumber(adMonth.appKeyword) : '-'}
              subtitle={adKpiSubtitle}
              icon="bi-phone"
              color="#BFAE8E"
              rankRow={<RankBadgeRow ranks={adRanks} rankField="rankKw" valueField="appKeyword" valueLabel="投放" />}
            />
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            <RankedStatCard
              title="PC首页广告统计次数"
              value={adMonth ? formatNumber(adMonth.pcHome) : '-'}
              subtitle={adKpiSubtitle}
              icon="bi-pc"
              color="#8FA3B0"
              rankRow={<RankBadgeRow ranks={adRanks} rankField="rankPc" valueField="pcHome" valueLabel="投放" />}
            />
          </div>
        </div>
      )}

      {/* 【游戏下载趋势】 */}
      {targetApp && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-white border-0">
            <div className="fw-semibold">【游戏下载趋势】</div>
            <div className="text-muted small">
              {targetApp.appName ? `${targetApp.appName}（` : ''}APPID {targetApp.appId}{targetApp.appName ? '）' : ''} · 本年 · 拖动下方刷选条可缩放时间范围
            </div>
          </div>
          <div className="card-body">
            {(downloadQuery.data?.series || []).some((s) => (s.data || []).length > 0) ? (
              <BrushLineChart
                id={`one-search-download-${targetApp.appId}`}
                series={downloadQuery.data?.series || []}
                brushSelection={downloadQuery.data?.selection || null}
                loading={downloadQuery.isLoading}
                error={downloadQuery.error?.message}
                height={380}
                brushHeight={80}
                colors={DOWNLOAD_SERIES.map((s) => s.color)}
                strokeWidth={2}
                xaxisOverrides={{ labels: { format: 'MM/dd', datetimeUTC: false, rotate: -45 } }}
                yaxisOverrides={{ title: { text: '下载数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
                legendOverrides={{ floating: true, position: 'top', horizontalAlign: 'center', fontSize: '10px', offsetY: 6 }}
              />
            ) : (
              <div className="text-center text-muted py-5">
                <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                {downloadQuery.isLoading ? '加载中…' : '该游戏在本年内没有下载数据'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 广告投放趋势（Tab 切换：APP首页 / APP搜索页关键词 / PC首页），三者 Brush 均默认最近7条 */}
      {appId && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-white border-0">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div className="btn-group btn-group-sm" role="group" aria-label="广告投放趋势切换">
                {AD_TREND_TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`btn ${adTrendTab === t.key ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setAdTrendTab(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <span className="text-muted small">本年 · 拖动下方刷选条可缩放时间范围</span>
            </div>
          </div>
          <div className="card-body">
            {/* APP首页广告投放趋势（按 app_id） */}
            {adTrendTab === 'landing' && (
              (landingTrendQuery.data?.series || []).some((s) => (s.data || []).length > 0) ? (
                <BrushLineChart
                  id={`one-search-landing-trend-${appId}`}
                  series={landingTrendQuery.data?.series || []}
                  brushSelection={landingTrendQuery.data?.selection || null}
                  loading={landingTrendQuery.isLoading}
                  error={landingTrendQuery.error?.message}
                  height={380}
                  brushHeight={80}
                  colors={LANDING_AD_SERIES.map((s) => s.color)}
                  strokeWidth={2}
                  xaxisOverrides={{ labels: { format: 'MM/dd', datetimeUTC: false, rotate: -45 } }}
                  yaxisOverrides={{ title: { text: '曝光次数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
                  legendOverrides={{ floating: true, position: 'top', horizontalAlign: 'center', fontSize: '11px', offsetY: 6 }}
                />
              ) : (
                <div className="text-center text-muted py-5">
                  <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                  {landingTrendQuery.isLoading ? '加载中…' : '该游戏在本年内没有首页广告数据'}
                </div>
              )
            )}

            {/* APP搜索页关键词广告投放趋势（按 app_id） */}
            {adTrendTab === 'keyword' && (
              (keywordTrendQuery.data?.series || []).some((s) => (s.data || []).length > 0) ? (
                <BrushLineChart
                  id={`one-search-keyword-trend-${appId}`}
                  series={keywordTrendQuery.data?.series || []}
                  brushSelection={keywordTrendQuery.data?.selection || null}
                  loading={keywordTrendQuery.isLoading}
                  error={keywordTrendQuery.error?.message}
                  height={380}
                  brushHeight={80}
                  colors={KEYWORD_AD_SERIES.map((s) => s.color)}
                  strokeWidth={2}
                  xaxisOverrides={{ labels: { format: 'MM/dd', datetimeUTC: false, rotate: -45 } }}
                  yaxisOverrides={{ title: { text: '曝光次数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
                  legendOverrides={{ floating: true, position: 'top', horizontalAlign: 'center', fontSize: '11px', offsetY: 6 }}
                />
              ) : (
                <div className="text-center text-muted py-5">
                  <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                  {keywordTrendQuery.isLoading ? '加载中…' : '该游戏在本年内没有关键词广告数据'}
                </div>
              )
            )}

            {/* PC首页广告投放趋势（按 app_id） */}
            {adTrendTab === 'pc' && (
              (pcAdTrendQuery.data?.series || []).some((s) => (s.data || []).length > 0) ? (
                <BrushLineChart
                  id={`one-search-pc-ad-trend-${appId}`}
                  series={pcAdTrendQuery.data?.series || []}
                  brushSelection={pcAdTrendQuery.data?.selection || null}
                  loading={pcAdTrendQuery.isLoading}
                  error={pcAdTrendQuery.error?.message}
                  height={380}
                  brushHeight={80}
                  colors={PC_AD_SERIES.map((s) => s.color)}
                  strokeWidth={2}
                  xaxisOverrides={{ labels: { format: 'MM/dd', datetimeUTC: false, rotate: -45 } }}
                  yaxisOverrides={{ title: { text: '曝光次数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
                  legendOverrides={{ floating: true, position: 'top', horizontalAlign: 'center', fontSize: '11px', offsetY: 6 }}
                />
              ) : (
                <div className="text-center text-muted py-5">
                  <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                  {pcAdTrendQuery.isLoading ? '加载中…' : '该游戏在本年内没有 PC 首页广告数据'}
                </div>
              )
            )}
          </div>
        </div>
      )}
      {appId && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-white border-0">
            <div className="fw-semibold">【峰值人数在线趋势】</div>
            <div className="text-muted small">
              {targetApp?.appName ? `${targetApp.appName}（` : ''}APPID {targetApp?.appId ?? appId}{targetApp?.appName ? '）' : ''} · 本月 · 拖动下方刷选条可缩放时间范围
            </div>
          </div>
          <div className="card-body">
            {(onlineTrendQuery.data?.series || []).some((s) => (s.data || []).length > 0) ? (
              <BrushLineChart
                id={`one-search-online-trend-${appId}`}
                series={onlineTrendQuery.data?.series || []}
                brushSelection={onlineTrendQuery.data?.selection || null}
                loading={onlineTrendQuery.isLoading}
                error={onlineTrendQuery.error?.message}
                height={380}
                brushHeight={80}
                colors={['#7A8B99']}
                strokeWidth={2}
                xaxisOverrides={{ labels: { format: 'MM/dd HH时', datetimeUTC: false, rotate: -45 } }}
                yaxisOverrides={{ title: { text: '在线人数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
                legendOverrides={{ floating: true, position: 'top', horizontalAlign: 'center', fontSize: '10px', offsetY: 6 }}
              />
            ) : (
              <div className="text-center text-muted py-5">
                <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                {onlineTrendQuery.isLoading ? '加载中…' : '该游戏在本月没有在线数据'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
