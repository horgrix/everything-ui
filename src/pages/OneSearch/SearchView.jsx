import { useSearchParams } from 'react-router-dom';
import useChartData from '../../hooks/useChartData';
import { querySqlV09 } from '../../api/query';
import BrushLineChart from '../../components/charts/BrushLineChart';
import DashboardCard from '../../components/layout/DashboardCard';
import { PC_GAME_TYPE_META, PercentBar } from '../TapTapReport/shared';
import { formatCompactNumber, formatNumber } from '../../utils/formatters';


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

/** 标签底色（与其它页面一致） */
const TAG_COLORS = ['#7A8B99', '#7D8F7B', '#B08B8B'];

/** 下载趋势的系列定义 */
const DOWNLOAD_SERIES = [
  { name: '总下载数', field: 'download_count', color: '#7A8B99' },
  { name: 'PC端下载数', field: 'pc_download_count', color: '#9CAF9F' },
  { name: '移动端下载数', field: 'app_download_count', color: '#C4A4A4' },
];

/** 首页广告投放趋势系列 */
const LANDING_AD_SERIES = [
  { name: '总曝光', field: 'total_views', color: '#7A8B99' },
  { name: '首页广告', field: 'ad_views', color: '#8FA3B0' },
  { name: '资源互换', field: 'pcebid_views', color: '#9B93A8' },
];

/** 关键词广告投放趋势系列 */
const KEYWORD_AD_SERIES = [
  { name: '总曝光', field: 'total_views', color: '#7A8B99' },
  { name: '搜索发现', field: 'discover_views', color: '#9CAF9F' },
  { name: '热搜', field: 'hot_search_views', color: '#D0B4B4' },
  { name: '搜点', field: 'hot_spot_views', color: '#C9B79C' },
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
          <div
            className="rounded-4 d-flex align-items-center justify-content-center fw-bold text-white flex-shrink-0"
            style={{ width: 60, height: 60, fontSize: 26, backgroundColor: avatarColor(game.appId) }}
            aria-hidden="true"
          >
            {name.trim().charAt(0)}
          </div>

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

/** 排名卡片：数字排名作为图标块 + 数量 + 数据月份 */
function RankCard({ title, rank, count, color, month }) {
  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body d-flex align-items-center gap-3">
        <div
          className="rounded-4 d-flex align-items-center justify-content-center fw-bold text-white flex-shrink-0"
          style={{ width: 56, height: 56, fontSize: 22, lineHeight: 1, backgroundColor: color }}
          aria-label={`${title} ${rank ?? '-'}`}
        >
          {rank != null ? rank : '-'}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="text-muted small mb-1">{title}</div>
          <div className="fw-bold" style={{ fontSize: 18, lineHeight: 1.2 }}>
            {count != null ? formatNumber(count) : '-'}
          </div>
          {month && (
            <div className="text-muted" style={{ fontSize: 11 }}>
              数据月份 {month}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 带排名图标块的统计卡：排名块（数字 + 底色） + 数值 + 统计时间 */
function RankedStatCard({ title, value, subtitle, rank, rankLabel, color = '#8FA3B0' }) {
  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body">
        <p className="text-muted small mb-1">{title}</p>
        <div className="d-flex align-items-center gap-2 mb-1">
          {rank != null ? (
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
        {subtitle && <small className="text-muted">{subtitle}</small>}
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
 * - 【游戏基本信息】：按 APPID 精确匹配 dws_taptap_game_set_monthly（走 v09 SQL 接口），取本月数据
 * - 【游戏下载趋势】：该 APPID 本年的下载趋势，Brush 默认选中最近15条
 */
export default function SearchView() {
  const [params] = useSearchParams();
  const keyword = (params.get('q') || '').trim();
  const isAppId = /^\d+$/.test(keyword);
  const appId = isAppId ? Number(keyword) : null;
  const month = currentMonth();

  const infoQuery = useChartData(
    `one-search-info-v09-${keyword}-${month}`,
    () =>
      querySqlV09(
        `SELECT app_id, app_name, tag_1, tag_2, tag_3, distribution_type
         FROM dws_taptap_game_set_monthly
         WHERE app_id = ${appId} AND crawled_at = '${month}'`
      ),
    {},
    {
      enabled: !!appId,
      transform: (rows) =>
        (rows || []).map((r) => ({
          appId: r.app_id,
          appName: r.app_name,
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

  // 【下载量】本月总量 / 日均（该表为日期粒度）
  const downloadKpiQuery = useChartData(
    `one-search-download-kpi-${keyword}-${month}`,
    () =>
      querySqlV09(
        `SELECT crawled_at, download_count
         FROM dws_taptap_download_daily
         WHERE app_id = ${appId}
           AND crawled_at >= '${range.startDate}' AND crawled_at < '${range.endDate}'
         ORDER BY crawled_at ASC`
      ),
    {},
    {
      enabled: !!appId,
      transform: (rows) => {
        if (!rows || rows.length === 0) return null;
        let sum = 0;
        let days = 0;
        for (const r of rows) {
          const v = r.download_count == null ? null : Number(r.download_count);
          if (v == null || Number.isNaN(v)) continue;
          sum += v;
          days += 1;
        }
        if (!days) return null;
        return {
          total: sum,
          avgPerDay: Math.round(sum / days),
          days,
          firstAt: rows[0].crawled_at,
          lastAt: rows[rows.length - 1].crawled_at,
        };
      },
    }
  );
  const downloadKpi = downloadKpiQuery.data;

  // 【广告】本月总次数 / 首页广告 / 资源互换 / 广告比例
  const adQuery = useChartData(
    `one-search-ad-${keyword}-${month}`,
    () =>
      querySqlV09(
        `SELECT crawled_at, total_views, ad_views, pcebid_views
         FROM dws_taptap_app_landing_ad_daily
         WHERE app_id = ${appId}
           AND crawled_at >= '${range.startDate}' AND crawled_at < '${range.endDate}'
         ORDER BY crawled_at ASC`
      ),
    {},
    {
      enabled: !!appId,
      transform: (rows) => {
        if (!rows || rows.length === 0) return null;
        const n = (v) => (v == null ? 0 : Number(v) || 0);
        let total = 0;
        let ad = 0;
        let pcebid = 0;
        for (const r of rows) {
          total += n(r.total_views);
          ad += n(r.ad_views);
          pcebid += n(r.pcebid_views);
        }
        return {
          total,
          ad,
          pcebid,
          // 首页广告比例 = （首页广告次数 + 资源互换次数）/ 首页广告总统计次数
          ratio: total > 0 ? Math.round(((ad + pcebid) / total) * 10000) / 100 : null,
          days: rows.length,
          firstAt: rows[0].crawled_at,
          lastAt: rows[rows.length - 1].crawled_at,
        };
      },
    }
  );
  const ad = adQuery.data;
  const adSubtitle = ad
    ? `统计时间 ${ad.firstAt} ~ ${ad.lastAt}（${ad.days} 天）`
    : adQuery.isLoading
      ? '加载中…'
      : '本月暂无数据';

  // 【关键词广告】本月总量 / 分来源 / 广告比例（该表以 keyword 为维度，用 app_name 匹配）
  const appName = games[0]?.appName || '';
  const keywordAdQuery = useChartData(
    `one-search-keyword-ad-${appName}-${month}`,
    () =>
      querySqlV09(
        `SELECT crawled_at, total_views, discover_views, hot_search_views, hot_spot_views, ad_views
         FROM dws_taptap_app_keywords_ad_daily
         WHERE keyword = '${String(appName).replace(/'/g, "''")}'
           AND crawled_at >= '${range.startDate}' AND crawled_at < '${range.endDate}'
         ORDER BY crawled_at ASC`
      ),
    {},
    {
      enabled: !!appName,
      transform: (rows) => {
        if (!rows || rows.length === 0) return null;
        const n = (v) => (v == null ? 0 : Number(v) || 0);
        let total = 0;
        let discover = 0;
        let hotSearch = 0;
        let hotSpot = 0;
        let ads = 0;
        for (const r of rows) {
          total += n(r.total_views);
          discover += n(r.discover_views);
          hotSearch += n(r.hot_search_views);
          hotSpot += n(r.hot_spot_views);
          ads += n(r.ad_views);
        }
        return {
          total,
          discover,
          hotSearch,
          hotSpot,
          // 关键词广告比例 = 广告曝光 / 总曝光
          ratio: total > 0 ? Math.round((ads / total) * 10000) / 100 : null,
          days: rows.length,
          firstAt: rows[0].crawled_at,
          lastAt: rows[rows.length - 1].crawled_at,
        };
      },
    }
  );
  const kwAd = keywordAdQuery.data;
  const kwAdSubtitle = kwAd
    ? `统计时间 ${kwAd.firstAt} ~ ${kwAd.lastAt}（${kwAd.days} 天）`
    : keywordAdQuery.isLoading
      ? '加载中…'
      : '本月暂无数据';

  // 【下载排名】本月总/移动端/PC 端排名（按 app_id 查）
  const rankQuery = useChartData(
    `one-search-rank-${appId ?? 'none'}-${month}`,
    () =>
      querySqlV09(
        `SELECT mobile_count, mobile_count_rank, pc_count, pc_count_rank, total_count, total_count_rank, crawled_at
         FROM dws_taptap_download_rank_monthly
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
          totalRank: n(r.total_count_rank),
          totalCount: n(r.total_count),
          mobileRank: n(r.mobile_count_rank),
          mobileCount: n(r.mobile_count),
          pcRank: n(r.pc_count_rank),
          pcCount: n(r.pc_count),
          month: r.crawled_at,
        };
      },
    }
  );
  const rankInfo = rankQuery.data;

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

  // 【首页广告投放排名】本月总/广告/资源互换排名
  const adRankQuery = useChartData(
    `one-search-ad-rank-${appId ?? 'none'}-${month}`,
    () =>
      querySqlV09(
        `SELECT ad_count, ad_count_rank, pcebid_count, pcebid_count_rank, total_count, total_count_rank, crawled_at
         FROM dws_taptap_app_landing_ad_rank_monthly
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
          totalRank: n(r.total_count_rank),
          totalCount: n(r.total_count),
          adRank: n(r.ad_count_rank),
          adCount: n(r.ad_count),
          pcebidRank: n(r.pcebid_count_rank),
          pcebidCount: n(r.pcebid_count),
          month: r.crawled_at,
        };
      },
    }
  );
  const adRank = adRankQuery.data;

  // 【关键词广告投放排名】本月总/搜索发现/热搜/搜点排名（表以 keyword 为维度，用 app_name 匹配）
  const kwAdRankQuery = useChartData(
    `one-search-keyword-ad-rank-${appName}-${month}`,
    () =>
      querySqlV09(
        `SELECT discover_ad_count, discover_ad_count_rank, hot_search_ad_count, hot_search_ad_count_rank,
                hot_spot_ad_count, hot_spot_ad_count_rank, total_count, total_count_rank, crawled_at
         FROM dws_taptap_app_keywords_ad_rank_monthly
         WHERE keyword = '${String(appName).replace(/'/g, "''")}' AND crawled_at = '${month}'`
      ),
    {},
    {
      enabled: !!appName,
      transform: (rows) => {
        if (!rows || rows.length === 0) return null;
        const n = (v) => (v == null ? null : Number(v));
        const r = rows[0];
        return {
          totalRank: n(r.total_count_rank),
          discoverRank: n(r.discover_ad_count_rank),
          hotSearchRank: n(r.hot_search_ad_count_rank),
          hotSpotRank: n(r.hot_spot_ad_count_rank),
          month: r.crawled_at,
        };
      },
    }
  );
  const kwAdRank = kwAdRankQuery.data;

  // 【首页广告投放趋势】本年，按 app_id
  const landingTrendQuery = useChartData(
    `one-search-landing-trend-${appId ?? 'none'}-${thisYear.start}`,
    () =>
      querySqlV09(
        `SELECT crawled_at, total_views, ad_views, pcebid_views
         FROM dws_taptap_app_landing_ad_daily
         WHERE app_id = ${appId}
           AND crawled_at >= '${thisYear.start}' AND crawled_at < '${thisYear.end}'
         ORDER BY crawled_at ASC`
      ),
    {},
    { enabled: !!appId, transform: (rows) => buildBrushSeries(rows, LANDING_AD_SERIES, 7) }
  );

  // 【关键词广告投放趋势】本年，按 app_name（表以 keyword 为维度）
  const keywordTrendQuery = useChartData(
    `one-search-keyword-trend-${appName || 'none'}-${thisYear.start}`,
    () =>
      querySqlV09(
        `SELECT crawled_at, total_views, discover_views, hot_search_views, hot_spot_views
         FROM dws_taptap_app_keywords_ad_daily
         WHERE keyword = '${String(appName).replace(/'/g, "''")}'
           AND crawled_at >= '${thisYear.start}' AND crawled_at < '${thisYear.end}'
         ORDER BY crawled_at ASC`
      ),
    {},
    { enabled: !!appName, transform: (rows) => buildBrushSeries(rows, KEYWORD_AD_SERIES, 7) }
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

  return (
    <div className="container-fluid p-4">
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
                    { label: '总下载', fullLabel: '总下载排名', rank: rankInfo ? rankInfo.totalRank : null, color: '#7A8B99' },
                    { label: '峰值在线', fullLabel: '峰值在线排名', rank: onlineRank ? onlineRank.peakRank : null, color: '#8FA3B0' },
                    { label: '首页投放', fullLabel: '首页总投放排名', rank: adRank ? adRank.totalRank : null, color: '#BFAE8E' },
                    { label: '关键词投放', fullLabel: '关键词广告总投放排名', rank: kwAdRank ? kwAdRank.totalRank : null, color: '#C9B79C' },
                  ]}
                />
              </div>
            ))}
            <div className="col-12 col-xl-8 d-none d-xl-block">
              <FootprintTrail />
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
              icon="bi-graph-up-arrow"
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
            />
          </div>
        </div>
      )}

      {/* 【下载量】总下载量 / 日均下载量 / 移动端排名 / PC端排名 */}
      {appId && (
        <div className="row g-3 mb-4">
          <div className="col-12 col-sm-6 col-xl-3">
            <DashboardCard
              title="总下载量"
              value={downloadKpi ? formatNumber(downloadKpi.total) : '-'}
              subtitle={
                downloadKpi
                  ? `统计时间 ${downloadKpi.firstAt} ~ ${downloadKpi.lastAt}（${downloadKpi.days} 天）`
                  : downloadKpiQuery.isLoading
                    ? '加载中…'
                    : '本月暂无数据'
              }
              icon="bi-download"
              color="success"
            />
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            <DashboardCard
              title="日均下载量"
              value={downloadKpi ? formatNumber(downloadKpi.avgPerDay) : '-'}
              subtitle={
                downloadKpi
                  ? `统计时间 ${downloadKpi.firstAt} ~ ${downloadKpi.lastAt}（${downloadKpi.days} 天）`
                  : downloadKpiQuery.isLoading
                    ? '加载中…'
                    : '本月暂无数据'
              }
              icon="bi-bar-chart-line"
              color="warning"
            />
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            <RankCard
              title="移动端下载排名"
              rank={rankInfo ? rankInfo.mobileRank : null}
              count={rankInfo ? rankInfo.mobileCount : null}
              color="#9CAF9F"
              month={rankInfo ? rankInfo.month : ''}
            />
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            <RankCard
              title="PC端下载排名"
              rank={rankInfo ? rankInfo.pcRank : null}
              count={rankInfo ? rankInfo.pcCount : null}
              color="#C4A4A4"
              month={rankInfo ? rankInfo.month : ''}
            />
          </div>
        </div>
      )}

      {/* 【广告】总次数 / 首页广告 / 资源互换 / 广告比例 */}
      {appId && (
        <div className="row g-3 mb-4">
          <div className="col-12 col-sm-6 col-xl-3">
            <DashboardCard title="首页广告总统计次数" value={ad ? formatNumber(ad.total) : '-'} subtitle={adSubtitle} icon="bi-eye" color="primary" />
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            <RankedStatCard
              title="首页广告统计次数"
              value={ad ? formatNumber(ad.ad) : '-'}
              subtitle={adSubtitle}
              rank={adRank ? adRank.adRank : null}
              rankLabel="首页投放排名"
              color="#8FA3B0"
            />
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            <RankedStatCard
              title="资源互换广告统计次数"
              value={ad ? formatNumber(ad.pcebid) : '-'}
              subtitle={adSubtitle}
              rank={adRank ? adRank.pcebidRank : null}
              rankLabel="资源互换投放排名"
              color="#9B93A8"
            />
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <p className="text-muted small mb-1">首页广告比例</p>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div className="fw-bold" style={{ fontSize: 22, lineHeight: 1.2 }}>
                    {ad && ad.ratio != null ? `${ad.ratio}%` : '-'}
                  </div>
                  <div className="rounded-3 bg-warning bg-opacity-10 p-2 d-flex align-items-center justify-content-center" style={{ width: 40, height: 40 }}>
                    <i className="bi bi-percent text-warning"></i>
                  </div>
                </div>
                {ad && ad.ratio != null ? <PercentBar value={ad.ratio} color="#8FA3B0" /> : null}
                <small className="text-muted d-block mt-2">{adSubtitle}</small>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 【关键词广告】总次数 / 搜索发现 / 热搜 / 搜点 / 广告比例 */}
      {appName && (
        <div className="row g-3 mb-4">
          <div className="col-12 col-sm-6 col-xl">
            <DashboardCard title="关键词广告总统计次数" value={kwAd ? formatNumber(kwAd.total) : '-'} subtitle={kwAdSubtitle} icon="bi-key" color="primary" />
          </div>
          <div className="col-12 col-sm-6 col-xl">
            <RankedStatCard
              title="搜索发现广告统计次数"
              value={kwAd ? formatNumber(kwAd.discover) : '-'}
              subtitle={kwAdSubtitle}
              rank={kwAdRank ? kwAdRank.discoverRank : null}
              rankLabel="搜索发现投放排名"
              color="#9CAF9F"
            />
          </div>
          <div className="col-12 col-sm-6 col-xl">
            <RankedStatCard
              title="热搜广告统计次数"
              value={kwAd ? formatNumber(kwAd.hotSearch) : '-'}
              subtitle={kwAdSubtitle}
              rank={kwAdRank ? kwAdRank.hotSearchRank : null}
              rankLabel="热搜投放排名"
              color="#D0B4B4"
            />
          </div>
          <div className="col-12 col-sm-6 col-xl">
            <RankedStatCard
              title="搜点广告统计次数"
              value={kwAd ? formatNumber(kwAd.hotSpot) : '-'}
              subtitle={kwAdSubtitle}
              rank={kwAdRank ? kwAdRank.hotSpotRank : null}
              rankLabel="搜点投放排名"
              color="#B4AEC0"
            />
          </div>
          <div className="col-12 col-sm-6 col-xl">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <p className="text-muted small mb-1">关键词广告比例</p>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div className="fw-bold" style={{ fontSize: 22, lineHeight: 1.2 }}>
                    {kwAd && kwAd.ratio != null ? `${kwAd.ratio}%` : '-'}
                  </div>
                  <div className="rounded-3 bg-warning bg-opacity-10 p-2 d-flex align-items-center justify-content-center" style={{ width: 40, height: 40 }}>
                    <i className="bi bi-percent text-warning"></i>
                  </div>
                </div>
                {kwAd && kwAd.ratio != null ? <PercentBar value={kwAd.ratio} color="#8FA3B0" /> : null}
                <small className="text-muted d-block mt-2">{kwAdSubtitle}</small>
              </div>
            </div>
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

      {/* 【首页广告投放趋势】 + 【关键词广告投放趋势】并排各 50% */}
      {(targetApp || appName) && (
        <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
          {/* 首页广告投放趋势（按 app_id） */}
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0">
                <div className="fw-semibold">【首页广告投放趋势】</div>
                <div className="text-muted small">本年 · 拖动下方刷选条可缩放时间范围</div>
              </div>
              <div className="card-body">
                {(landingTrendQuery.data?.series || []).some((s) => (s.data || []).length > 0) ? (
                  <BrushLineChart
                    id={`one-search-landing-trend-${appId}`}
                    series={landingTrendQuery.data?.series || []}
                    brushSelection={landingTrendQuery.data?.selection || null}
                    loading={landingTrendQuery.isLoading}
                    error={landingTrendQuery.error?.message}
                    height={340}
                    brushHeight={70}
                    colors={LANDING_AD_SERIES.map((s) => s.color)}
                    strokeWidth={2}
                    xaxisOverrides={{ labels: { format: 'MM/dd', datetimeUTC: false, rotate: -45 } }}
                    yaxisOverrides={{ title: { text: '曝光次数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
                    legendOverrides={{ floating: true, position: 'top', horizontalAlign: 'center', fontSize: '10px', offsetY: 6 }}
                  />
                ) : (
                  <div className="text-center text-muted py-5">
                    <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                    {landingTrendQuery.isLoading ? '加载中…' : '该游戏在本年内没有首页广告数据'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 关键词广告投放趋势（按 app_name） */}
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0">
                <div className="fw-semibold">【关键词广告投放趋势】</div>
                <div className="text-muted small">本年 · 拖动下方刷选条可缩放时间范围</div>
              </div>
              <div className="card-body">
                {(keywordTrendQuery.data?.series || []).some((s) => (s.data || []).length > 0) ? (
                  <BrushLineChart
                    id={`one-search-keyword-trend-${appName}`}
                    series={keywordTrendQuery.data?.series || []}
                    brushSelection={keywordTrendQuery.data?.selection || null}
                    loading={keywordTrendQuery.isLoading}
                    error={keywordTrendQuery.error?.message}
                    height={340}
                    brushHeight={70}
                    colors={KEYWORD_AD_SERIES.map((s) => s.color)}
                    strokeWidth={2}
                    xaxisOverrides={{ labels: { format: 'MM/dd', datetimeUTC: false, rotate: -45 } }}
                    yaxisOverrides={{ title: { text: '曝光次数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
                    legendOverrides={{ floating: true, position: 'top', horizontalAlign: 'center', fontSize: '10px', offsetY: 6 }}
                  />
                ) : (
                  <div className="text-center text-muted py-5">
                    <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                    {keywordTrendQuery.isLoading ? '加载中…' : '该关键词在本年内没有广告数据'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 【峰值人数在线趋势】本月，Brush 默认选中最近 24 条（小时） */}
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
