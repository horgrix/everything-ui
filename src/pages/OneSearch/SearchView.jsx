import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import useChartData from '../../hooks/useChartData';
import { querySql, querySqlV09 } from '../../api/query';
import BrushLineChart from '../../components/charts/BrushLineChart';
import Sparkline from '../../components/common/Sparkline';
import { recentDaysWhere, recentHoursWhere } from '../TapTapReport/dates';
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

/** 本月窗口：月初 00 点 ~ 下月月初 00 点（crawled_at 为 'YYYY-MM-DD HH' 本地时间） */
function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const next = new Date(y, m, 1);
  const pad = (x) => String(x).padStart(2, '0');
  return {
    startHour: `${month}-01 00`,
    endDate: `${next.getFullYear()}-${pad(next.getMonth() + 1)}-01 00`,
  };
}

/** 本月（YYYY-MM） */
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 秒级时间戳 → 'YYYY-MM-DD HH:mm:ss'（本地时区）；无效值返回空串 */
function formatTimestamp(ts) {
  const n = Number(ts);
  if (!n) return '';
  const d = new Date(n * 1000);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 单个信息块：标签在上、值在下（数字用等宽感更强的加粗） */
function InfoCell({ label, value, hint = null }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="text-muted" style={{ fontSize: 11, lineHeight: 1.3 }}>{label}</div>
      <div className="fw-semibold" style={{ fontSize: 13.5, lineHeight: 1.5, color: '#1F272E' }}>
        {value}
        {hint ? <span className="text-muted fw-normal ms-1" style={{ fontSize: 11 }}>{hint}</span> : null}
      </div>
    </div>
  );
}

/** 星级分布：5★ → 1★ 每行「几星 + 细条形 + 数量」 */
function StarBars({ votes }) {
  const total = votes.reduce((a, v) => a + (v.count || 0), 0);
  const rows = [...votes].sort((a, b) => b.star - a.star);
  return (
    <div className="d-flex flex-column" style={{ gap: 3 }}>
      {rows.map((v) => {
        const pct = total > 0 ? (v.count / total) * 100 : 0;
        return (
          <div key={v.star} className="d-flex align-items-center gap-2" style={{ fontSize: 11 }}>
            <span className="text-muted flex-shrink-0" style={{ width: 22 }}>{v.star}★</span>
            <span className="flex-grow-1 rounded-pill" style={{ height: 5, backgroundColor: '#EDF0F2', minWidth: 40 }}>
              <span
                className="d-block rounded-pill"
                style={{ width: `${pct}%`, height: 5, backgroundColor: '#C9B79C' }}
              />
            </span>
            <span className="text-muted text-end flex-shrink-0" style={{ width: 46 }}>{formatNumber(v.count)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** 【游戏基本信息】简洁卡片：身份信息 + 发布/评分 + 星级分布 */
function GameInfoCard({ game }) {
  const name = String(game.appName || '未知');
  const tags = [game.tag1, game.tag2, game.tag3].filter(Boolean);
  const typeMeta = PC_GAME_TYPE_META[game.distributionType];
  const votes = game.votes || [];

  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body">
        <div className="d-flex gap-3 align-items-start">
          <GameAvatar appId={game.appId} name={name} icon={game.icon} />

          <div className="flex-grow-1" style={{ minWidth: 0 }}>
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

        {/* 总预约 / 总APP下载 / 总PC下载 / 总PC售卖 */}
        <div className="row g-2 mt-3 pt-3 border-top">
          <div className="col-3">
            <InfoCell label="总预约数" value={game.reserveCount != null ? formatNumber(game.reserveCount) : '-'} />
          </div>
          <div className="col-3">
            <InfoCell label="总APP下载数" value={game.appDownloadCount != null ? formatNumber(game.appDownloadCount) : '-'} />
          </div>
          <div className="col-3">
            <InfoCell label="总PC下载数" value={game.pcDownloadCount != null ? formatNumber(game.pcDownloadCount) : '-'} />
          </div>
          <div className="col-3">
            <InfoCell label="总PC售卖数" value={game.pcSaleCount != null ? formatNumber(game.pcSaleCount) : '-'} />
          </div>
        </div>

        {/* 发布 / 评分 */}
        <div className="row g-2 mt-2">
          <div className="col-12">
            <InfoCell label="发布时间" value={game.releasedAt || '-'} />
          </div>
          <div className="col-6">
            <InfoCell
              label="总评分"
              value={game.ratingScore != null ? game.ratingScore.toFixed(1) : '-'}
              hint={game.ratingMax != null ? `/ ${game.ratingMax}` : null}
            />
          </div>
          <div className="col-6">
            <InfoCell
              label="最近评分"
              value={game.ratingLatest != null ? game.ratingLatest.toFixed(1) : '-'}
              hint={game.ratingMax != null ? `/ ${game.ratingMax}` : null}
            />
          </div>
        </div>

        {/* 星级分布 */}
        <div className="mt-3 pt-3 border-top">
          <div className="text-muted mb-1" style={{ fontSize: 11 }}>星级分布</div>
          <StarBars votes={votes} />
        </div>
      </div>
    </div>
  );
}

/** 本年（起含、止不含） */
function yearRange() {
  const y = new Date().getFullYear();
  return { start: `${y}-01-01`, end: `${y + 1}-01-01` };
}

/** 离线数据截至日期：09:05 之前 → 2 天前，否则 1 天前（YYYY-MM-DD） */
function offlineCutoffStr(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const beforeGrace = from.getHours() < 9 || (from.getHours() === 9 && from.getMinutes() < 5);
  d.setDate(d.getDate() - (beforeGrace ? 2 : 1));
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYY-MM-DD HH' → 'YYYY-MM-DD HH:00'（小时表时间粒度） */
function hourLabel(ts) {
  const v = String(ts || '');
  return /^\d{4}-\d{2}-\d{2} \d{2}/.test(v) ? `${v.slice(0, 13)}:00` : v;
}

/**
 * 数据口径说明面板：离线数据截至日期 / 实时数据 并排展示
 * - 离线：09:05 前 → 前天，否则昨天（离线数据不含今日）
 * - 实时：今日 00:00 ~ taptap_game_info_hourly 最新时刻
 */
function DataNotePanel({ realtimeHour }) {
  const offlineCutoff = offlineCutoffStr();
  const latest = hourLabel(realtimeHour);
  const todayStr = (() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();
  const realtimeReady = latest && latest.slice(0, 10) === todayStr;

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body">
        <div className="row g-3">
          {/* 离线数据 */}
          <div className="col-12 col-md-6 d-flex flex-column">
            <div className="d-flex align-items-center gap-3">
              <span
                className="rounded-3 d-inline-flex align-items-center justify-content-center text-white flex-shrink-0"
                style={{ width: 38, height: 38, backgroundColor: '#7A8B99' }}
              >
                <i className="bi bi-calendar-check" style={{ fontSize: 18 }}></i>
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="text-muted" style={{ fontSize: 12 }}>离线数据截至日期</div>
                <div className="fw-bold" style={{ fontSize: 20, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
                  {offlineCutoff}
                </div>
              </div>
            </div>
            <div
              className="d-flex align-items-start gap-2 rounded-3 px-2 py-2 mt-2"
              style={{ background: '#F5F7F9', color: '#6C757D', fontSize: 12, lineHeight: 1.6 }}
            >
              <i className="bi bi-info-circle mt-1 flex-shrink-0"></i>
              <span>离线计算数据，不包含今日最新的实时数据</span>
            </div>
          </div>

          {/* 实时数据 */}
          <div className="col-12 col-md-6 d-flex flex-column">
            <div className="d-flex align-items-center gap-3">
              <span
                className="rounded-3 d-inline-flex align-items-center justify-content-center text-white flex-shrink-0"
                style={{ width: 38, height: 38, backgroundColor: '#9CAF9F' }}
              >
                <i className="bi bi-broadcast" style={{ fontSize: 18 }}></i>
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="text-muted" style={{ fontSize: 12 }}>实时数据</div>
                <div className="fw-bold" style={{ fontSize: 16, lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }}>
                  {realtimeReady ? `${todayStr} 00:00 ~ ${latest.slice(11)}` : '-'}
                </div>
              </div>
            </div>
            <div
              className="d-flex align-items-start gap-2 rounded-3 px-2 py-2 mt-2"
              style={{ background: '#F1F6F2', color: '#5C6873', fontSize: 12, lineHeight: 1.6 }}
            >
              <i className="bi bi-info-circle mt-1 flex-shrink-0"></i>
              <span>实时计算数据，仅包含今日数据</span>
            </div>
          </div>
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

  // 【游戏基本信息】SQLite 的 taptap_game_info_hourly，只取最新一份快照
  const infoQuery = useChartData(
    `one-search-info-game-${keyword}`,
    () =>
      querySql(
        `SELECT app_id, app_name, icon, tag_1, tag_2, tag_3, distribution_type,
                released_time, rating_score, rating_max, rating_latest_score,
                vote_1, vote_2, vote_3, vote_4, vote_5,
                reserve_count, hits_total, pc_download_count, pc_sale_count
         FROM taptap_game_info_hourly
         WHERE app_id = ${appId}
           AND crawled_at = (SELECT MAX(crawled_at) FROM taptap_game_info_hourly)
         LIMIT 1`
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
          releasedAt: formatTimestamp(r.released_time),
          reserveCount: r.reserve_count != null ? Number(r.reserve_count) : null,
          appDownloadCount: r.hits_total != null ? Number(r.hits_total) : null,
          pcDownloadCount: r.pc_download_count != null ? Number(r.pc_download_count) : null,
          pcSaleCount: r.pc_sale_count != null ? Number(r.pc_sale_count) : null,
          ratingScore: r.rating_score != null ? Number(r.rating_score) : null,
          ratingMax: r.rating_max != null ? Number(r.rating_max) : null,
          ratingLatest: r.rating_latest_score != null ? Number(r.rating_latest_score) : null,
          votes: [1, 2, 3, 4, 5].map((star) => ({
            star,
            count: Number(r[`vote_${star}`] || 0),
          })),
        })),
    }
  );

  // 【实时数据】taptap_game_info_hourly 最新一份快照的时间（今日 0 点 ~ 该时刻）
  const realtimeHourQuery = useChartData(
    'one-search-realtime-hour',
    () => querySql('SELECT MAX(crawled_at) AS latest FROM taptap_game_info_hourly'),
    {},
    {
      enabled: true,
      staleTime: 5 * 60 * 1000,
      transform: (rows) => (rows && rows[0] ? rows[0].latest : null),
    }
  );

  const games = infoQuery.data || [];
  const targetApp = games[0] || (appId ? { appId, appName: '' } : null);

  // 【当前在线人数】SQLite 的 dws_taptap_pc_online_peak_players_details_hourly：最新一小时的值 + 最近 24 小时趋势
  const currentOnlineQuery = useChartData(
    `one-search-current-online-${keyword}`,
    () =>
      querySql(
        `SELECT crawled_at, SUM(online_players) AS players
         FROM dws_taptap_pc_online_peak_players_details_hourly
         WHERE app_id = ${appId}
           AND crawled_at >= '${recentHoursWhere(24)}'
         GROUP BY crawled_at
         ORDER BY crawled_at ASC`
      ),
    {},
    {
      enabled: !!appId,
      transform: (rows) => {
        const list = rows || [];
        if (!list.length) return null;
        const values = list.map((r) => Number(r.players || 0));
        const lastIdx = list.length - 1;
        const sum = values.reduce((a, b) => a + b, 0);
        return {
          current: values[lastIdx],
          latestAt: list[lastIdx].crawled_at,
          series: values,
          labels: list.map((r) => String(r.crawled_at || '').slice(11, 16)),
          avg24: Math.round(sum / values.length),
          max24: Math.max(...values),
          min24: Math.min(...values),
        };
      },
    }
  );
  const currentOnline = currentOnlineQuery.data;
  const thisYear = yearRange();

  // 【今日下载量】SQLite 的 dws_taptap_download_v2_hourly：今日累计 + 最近 24 小时逐小时趋势
  const todayDownloadQuery = useChartData(
    `one-search-today-download-${keyword}`,
    () =>
      querySql(
        `SELECT crawled_at, SUM(download_count) AS cnt
         FROM dws_taptap_download_v2_hourly
         WHERE app_id = ${appId}
           AND crawled_at >= '${recentHoursWhere(24)}'
         GROUP BY crawled_at
         ORDER BY crawled_at ASC`
      ),
    {},
    {
      enabled: !!appId,
      transform: (rows) => {
        const list = rows || [];
        if (!list.length) return null;
        const values = list.map((r) => Number(r.cnt || 0));
        const todayStr = String(recentHoursWhere(0)).slice(0, 10);
        const todayTotal = list.reduce(
          (sum, r, idx) => (String(r.crawled_at).slice(0, 10) === todayStr ? sum + values[idx] : sum),
          0
        );
        const sum = values.reduce((a, b) => a + b, 0);
        const lastIdx = list.length - 1;
        return {
          todayTotal,
          latestAt: list[lastIdx].crawled_at,
          series: values,
          labels: list.map((r) => String(r.crawled_at || '').slice(11, 16)),
          avg24: Math.round(sum / values.length),
          max24: Math.max(...values),
          min24: Math.min(...values),
        };
      },
    }
  );
  const todayDownload = todayDownloadQuery.data;

  // 【今日广告曝光】SQLite 的 dws_taptap_ad_aggr_v6_daily（日表，sparkline 取最近 7 天）：
  //   APP首页 = app_ad_views + app_pcebid_views
  //   APP关键词 = kw_ad_views + kw_pcebid_views
  //   PC首页 = pc_ad_views + pc_pcebid_views
  const adExposureQuery = useChartData(
    `one-search-ad-exposure-${keyword}`,
    () =>
      querySql(
        `SELECT crawled_at,
                SUM(COALESCE(app_ad_views, 0)) + SUM(COALESCE(app_pcebid_views, 0)) AS app_home,
                SUM(COALESCE(kw_ad_views, 0)) + SUM(COALESCE(kw_pcebid_views, 0)) AS kw_search,
                SUM(COALESCE(pc_ad_views, 0)) + SUM(COALESCE(pc_pcebid_views, 0)) AS pc_home
         FROM dws_taptap_ad_aggr_v6_daily
         WHERE app_id = ${appId}
           AND crawled_at >= '${recentDaysWhere(7)}'
         GROUP BY crawled_at
         ORDER BY crawled_at ASC`
      ),
    {},
    {
      enabled: !!appId,
      transform: (rows) => {
        const list = rows || [];
        if (!list.length) return null;
        const todayStr = String(recentHoursWhere(0)).slice(0, 10);
        const pick = (field) => list.map((r) => Number(r[field] || 0));
        const todayOf = (field) => {
          const idx = list.findIndex((r) => String(r.crawled_at).slice(0, 10) === todayStr);
          return idx >= 0 ? Number(list[idx][field] || 0) : null;
        };
        return {
          labels: list.map((r) => String(r.crawled_at).slice(5, 10)),
          latestAt: list[list.length - 1].crawled_at,
          todayDepth: list.length,
          appHome: { today: todayOf('app_home'), series: pick('app_home') },
          kwSearch: { today: todayOf('kw_search'), series: pick('kw_search') },
          pcHome: { today: todayOf('pc_home'), series: pick('pc_home') },
        };
      },
    }
  );
  const adExposure = adExposureQuery.data;

  // 【在线人数排名】本月峰值/均值排名

  // 【APP首页广告投放趋势】本年，按 app_id（dws_taptap_ad_aggr_v6_daily 的 APP 首页渠道）
  const landingTrendQuery = useChartData(
    `one-search-landing-trend-v5-${appId ?? 'none'}-${thisYear.start}`,
    () =>
      querySqlV09(
        `SELECT crawled_at,
                COALESCE(app_ad_views, 0) AS ad_views,
                COALESCE(app_pcebid_views, 0) AS pcebid_views
         FROM dws_taptap_ad_aggr_v6_daily
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
         FROM dws_taptap_ad_aggr_v6_daily
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
         FROM dws_taptap_ad_aggr_v6_daily
         WHERE app_id = ${appId}
           AND crawled_at >= '${thisYear.start}' AND crawled_at < '${thisYear.end}'
         ORDER BY crawled_at ASC`
      ),
    {},
    { enabled: !!appId, transform: (rows) => buildBrushSeries(rows, PC_AD_SERIES, 7) }
  );

  // 【游戏下载趋势】本年逐日下载（MySQL v09 的 dws_taptap_download_v2_daily）
  const downloadQuery = useChartData(
    `one-search-download-${appId ?? 'none'}`,
    () =>
      querySqlV09(
        `SELECT crawled_at, download_count, pc_download_count, app_download_count
         FROM dws_taptap_download_v2_daily
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
  // 数据源：SQLite 的 dws_taptap_pc_online_peak_players_details_hourly
  const range = monthRange(month);
  const onlineTrendQuery = useChartData(
    `one-search-online-trend-${appId ?? 'none'}-${month}`,
    () =>
      querySql(
        `SELECT crawled_at, SUM(online_players) AS players
         FROM dws_taptap_pc_online_peak_players_details_hourly
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
  const bootQueries = [infoQuery, currentOnlineQuery, todayDownloadQuery, adExposureQuery];
  const bootDone = bootQueries.filter((q) => !q.isLoading).length;
  const bootReady = bootDone === bootQueries.length;

  return (
    <div className="os-page container-fluid p-4" style={{ maxWidth: 1440, margin: '0 auto' }}>
      <SearchLoadingOverlay
        progress={bootDone / bootQueries.length}
        ready={bootReady}
        label={`正在检索「${keyword || '—'}」的数据…`}
      />

      {/* 页头 */}
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3">
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.4, color: '#A7B0B8' }}>ONE SEARCH</div>
          <h1 style={{ fontSize: 27, fontWeight: 650, letterSpacing: -0.3, color: '#1B2228', margin: '4px 0 0' }}>
            游戏线索查询
          </h1>
          <div style={{ fontSize: 12.5, color: '#8A959E', marginTop: 6 }}>
            关键词
            <span style={{ color: '#3B4750', fontWeight: 600, marginLeft: 6 }}>{keyword || '（空）'}</span>
            {appId && <span style={{ color: '#A7B0B8', marginLeft: 8 }}>· 数据月份 {month}</span>}
          </div>
        </div>
      </div>

      {/* 【游戏基本信息】 */}
      <div className="mt-4 mb-4">
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.6, color: '#5C6873', marginBottom: 10 }}>
          游戏基本信息
        </div>

        {games.length ? (
          <div className="row g-3">
            {games.map((g) => (
              <div className="col-12 col-md-6 col-xl-4" key={g.appId}>
                <GameInfoCard game={g} />
              </div>
            ))}
            <div className="col-12 col-md-6 col-xl-8 d-flex flex-column">
              <DataNotePanel realtimeHour={realtimeHourQuery.data} />
              {/* 装饰动画：贴到列底部（mt-auto 吃掉剩余空间），警告紧随其下 */}
              <div className="d-none d-xl-block mt-auto pt-3" style={{ height: 160 }}>
                <FootprintTrail />
              </div>
              {/* 试验页面提醒 */}
              <div
                className="d-flex align-items-center justify-content-center gap-2 rounded-3 px-3 py-2"
                style={{ background: '#FFF9EC', border: '1px solid #F1E3C3', color: '#7A5C22', fontSize: 12, lineHeight: 1.6 }}
              >
                <i className="bi bi-exclamation-triangle-fill flex-shrink-0" style={{ fontSize: 13, color: '#C08A2E' }} aria-hidden="true"></i>
                <span>该页面为试验页面，可能会随时变更</span>
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

      {/* 【当前在线人数】最新一小时的值 + 最近 24 小时 sparkline */}
      {appId && (
        <div className="row g-3 mb-4">
          <div className="col-12">
            <div className="card border-0 shadow-sm" style={{ height: 120 }}>
              <div className="card-body d-flex align-items-center justify-content-between gap-3 flex-wrap">
                <div style={{ minWidth: 0 }}>
                  <div className="text-muted" style={{ fontSize: 12 }}>当前在线人数</div>
                  <div className="d-flex align-items-baseline gap-2">
                    <span className="fw-bold" style={{ fontSize: 28, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
                      {currentOnline ? formatNumber(currentOnline.current) : '-'}
                    </span>
                    <span className="text-muted" style={{ fontSize: 12 }}>人</span>
                  </div>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    {currentOnline
                      ? `统计时间 ${currentOnline.latestAt}`
                      : currentOnlineQuery.isLoading
                        ? '加载中…'
                        : '最近24小时暂无数据'}
                  </div>
                </div>

                {/* 24 小时平均 / 最大 / 最小 */}
                <div className="d-flex align-items-center gap-4 flex-wrap">
                  {[
                    { label: '24H平均在线人数', value: currentOnline?.avg24, color: '#7A8B99' },
                    { label: '24H最大在线人数', value: currentOnline?.max24, color: '#8FA3B0' },
                    { label: '24H最小在线人数', value: currentOnline?.min24, color: '#9B93A8' },
                  ].map((item) => (
                    <div key={item.label} style={{ minWidth: 0 }}>
                      <div className="text-muted" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{item.label}</div>
                      <div
                        className="fw-semibold"
                        style={{ fontSize: 18, lineHeight: 1.3, fontVariantNumeric: 'tabular-nums', color: item.color }}
                      >
                        {item.value != null ? formatNumber(item.value) : '-'}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="d-flex flex-column align-items-end gap-1" style={{ minWidth: 0 }}>
                  <Sparkline
                    data={currentOnline?.series || []}
                    labels={currentOnline?.labels || []}
                    width={260}
                    height={54}
                    color="#7A8B99"
                  />
                  <span className="text-muted" style={{ fontSize: 11 }}>最近 24 小时趋势</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 【今日下载量】今日累计 + 24H 平均/最大/最小 + 最近 24 小时 sparkline */}
      {appId && (
        <div className="row g-3 mb-4">
          <div className="col-12">
            <div className="card border-0 shadow-sm" style={{ height: 120 }}>
              <div className="card-body d-flex align-items-center justify-content-between gap-3 flex-wrap">
                <div style={{ minWidth: 0 }}>
                  <div className="text-muted" style={{ fontSize: 12 }}>今日下载量</div>
                  <div className="d-flex align-items-baseline gap-2">
                    <span className="fw-bold" style={{ fontSize: 28, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
                      {todayDownload ? formatNumber(todayDownload.todayTotal) : '-'}
                    </span>
                    <span className="text-muted" style={{ fontSize: 12 }}>次</span>
                  </div>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    {todayDownload
                      ? `最新数据 ${todayDownload.latestAt}`
                      : todayDownloadQuery.isLoading
                        ? '加载中…'
                        : '最近24小时暂无数据'}
                  </div>
                </div>

                {/* 24 小时平均 / 最大 / 最小下载量 */}
                <div className="d-flex align-items-center gap-4 flex-wrap">
                  {[
                    { label: '24H平均下载量', value: todayDownload?.avg24, color: '#7A8B99' },
                    { label: '24H最大下载量', value: todayDownload?.max24, color: '#8FA3B0' },
                    { label: '24H最小下载量', value: todayDownload?.min24, color: '#9B93A8' },
                  ].map((item) => (
                    <div key={item.label} style={{ minWidth: 0 }}>
                      <div className="text-muted" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{item.label}</div>
                      <div
                        className="fw-semibold"
                        style={{ fontSize: 18, lineHeight: 1.3, fontVariantNumeric: 'tabular-nums', color: item.color }}
                      >
                        {item.value != null ? formatNumber(item.value) : '-'}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="d-flex flex-column align-items-end gap-1" style={{ minWidth: 0 }}>
                  <Sparkline
                    data={todayDownload?.series || []}
                    labels={todayDownload?.labels || []}
                    width={260}
                    height={54}
                    color="#7D8F7B"
                  />
                  <span className="text-muted" style={{ fontSize: 11 }}>最近 24 小时趋势</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 【今日广告曝光】APP首页 / APP关键词 / PC首页（SQLite 日表 dws_taptap_ad_aggr_v6_daily） */}
      {appId && (
        <div className="row g-3 mb-4">
          {[
            { key: 'appHome', title: '今日APP首页广告曝光次数', color: '#7D8F7B' },
            { key: 'kwSearch', title: '今日APP关键词广告曝光次数', color: '#BFAE8E' },
            { key: 'pcHome', title: '今日PC首页广告曝光次数', color: '#8FA3B0' },
          ].map((cfg) => {
            const item = adExposure?.[cfg.key];
            return (
              <div className="col-12 col-md-6 col-xl-4" key={cfg.key}>
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body d-flex align-items-center justify-content-between gap-2">
                    <div style={{ minWidth: 0 }}>
                      <div className="text-muted" style={{ fontSize: 12 }}>{cfg.title}</div>
                      <div className="fw-bold" style={{ fontSize: 24, lineHeight: 1.25, fontVariantNumeric: 'tabular-nums' }}>
                        {item?.today != null ? formatNumber(item.today) : '-'}
                      </div>
                      <div className="text-muted" style={{ fontSize: 11.5 }}>
                        {adExposure
                          ? `最新日期 ${adExposure.latestAt}`
                          : adExposureQuery.isLoading
                            ? '加载中…'
                            : '最近24天暂无数据'}
                      </div>
                    </div>
                    <div className="d-flex flex-column align-items-end" style={{ minWidth: 0 }}>
                      <Sparkline data={item?.series || []} labels={adExposure?.labels || []} width={104} height={34} color={cfg.color} />
                      <span className="text-muted" style={{ fontSize: 10.5, whiteSpace: 'nowrap' }}>最近7天</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 【游戏下载趋势】 */}
      {targetApp && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-white border-0">
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#232B33' }}>游戏下载趋势</div>
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
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2" style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#232B33' }}>广告投放趋势</div>
              <span className="text-muted small">本年 · 拖动下方刷选条可缩放时间范围</span>
            </div>
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
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#232B33' }}>峰值人数在线趋势</div>
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
