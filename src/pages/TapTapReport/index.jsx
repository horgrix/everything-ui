import { useState, useEffect, useMemo } from 'react';
import BarChart from '../../components/charts/BarChart';
import LineChart from '../../components/charts/LineChart';
import MixedChart from '../../components/charts/MixedChart';
import PieChart from '../../components/charts/PieChart';
import TreemapChart from '../../components/charts/TreemapChart';
import HeatmapChart from '../../components/charts/HeatmapChart';
import { formatNumber, formatCompactNumber } from '../../utils/formatters';
import {
  buildAggregateSql,
  buildDetailSql,
  buildSummarySql,
  buildDailyTrendSql,
  buildMonthlyBreakdownSql,
  buildDistributionByWindowSql,
  buildTop25DetailSql,
  buildGameNameSql,
  buildOnlinePlayersTrendSql,
  buildOnlinePlayersStatsSql,
  buildOnlinePlayersDistributionSql,
  buildOnlinePlayersTopNTrendSql,
  buildOnlinePlayersSourceNewestSql,
  buildOnlinePlayersSourceSql,
  buildOnlinePlayersSourceGamesSql,
  buildTopNProportionSql,
  buildNewestDateSql,
  buildAdNewPositionStatsSql,
  buildAdMaterialTagsSql,
  buildAdMaterialGamesSql,
  buildAdGameListSql,
  buildAdTotalStatsSql,
  buildAdLoadingRateTrendSql,
  buildTapAppAdNewPositionStatsSql,
  buildTapAppAdMaterialTagsSql,
  buildTapAppAdMaterialGamesSql,
  buildTapAppAdGameListSql,
  buildTapAppAdGameDailyTrendSql,
  buildTapAppAdTotalStatsSql,
  buildTapAppAdLoadingRateTrendSql,
  buildTapAppSearchPositionStatsSql,
  buildTapAppSearchLoadingRateTrendSql,
  buildTapAppSearchKeywordStatsSql,
  buildTapAppSearchKeywordDailyTrendSql,
  buildTapAppSearchTotalStatsSql,
} from './sql';
import {
  transformAggregate,
  transformDetail,
  transformKpiSnapshot,
  transformDailyTrend,
  transformMonthlyBreakdown,
  transformDistributionByWindow,
  transformTop25Detail,
  transformGameNameMap,
  transformOnlinePlayersTrend,
  transformOnlinePlayersStats,
  transformOnlinePlayersDistribution,
  transformOnlinePlayersTopNTrend,
  transformOnlinePlayersSource,
  transformOnlinePlayersSourceGames,
  ONLINE_PLAYERS_BUCKETS,
  transformTopNProportion,
  transformNewestDate,
  transformAdNewPositionStats,
  transformAdMaterialTags,
  transformAdMaterialGames,
  transformAdGameList,
  transformTapAppAdGameDailyTrend,
  transformAdTotalStats,
  transformAdLoadingRateTrend,
  transformTapAppAdNewPositionStats,
  transformTapAppSearchPositionStats,
  transformTapAppSearchLoadingRateTrend,
  transformTapAppSearchKeywordStats,
  transformTapAppSearchKeywordDailyTrend,
  transformTapAppSearchTotalStats,
} from './transforms';
import { useSqlQuery } from './queries';
import DataTable from './components/DataTable';
import Sparkline from '../../components/common/Sparkline';
import KpiRow from './components/KpiRow';
import DashboardCard from '../../components/layout/DashboardCard';

/** 时间范围快捷选项 */
const TIME_RANGES = [
  { label: '最近1天', days: 1 },
  { label: '最近3天', days: 3 },
  { label: '最近7天', days: 7 },
  { label: '最近15天', days: 15 },
  { label: '最近1个月', days: 30 },
  { label: '最近3个月', days: 90 },
  { label: '最近6个月', days: 180 },
  { label: '最近1年', days: 365 },
];

/** 下载Top25明细窗口类型 */
const WINDOW_TYPES = [
  { label: '小时', table: 'dws_taptap_download_hourly', granularity: 'hour' },
  { label: '日', table: 'dws_taptap_download_daily', granularity: 'day' },
  { label: '月', table: 'dws_taptap_download_monthly', granularity: 'month' },
];

/** 当前时间按窗口粒度格式化（hour: %Y-%m-%d %H，day: %Y-%m-%d，month: %Y-%m） */
function formatNowWindow(granularity) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  if (granularity === 'hour') return `${y}-${m}-${d} ${pad(now.getHours())}`;
  if (granularity === 'month') return `${y}-${m}`;
  return `${y}-${m}-${d}`;
}

/** 数据图表选择 */
const CHART_GROUPS = [
  { key: 'download', label: 'TapTap下载统计' },
  { key: 'online', label: 'TapPC在线人数统计' },
  { key: 'ad', label: 'TapPC广告统计' },
  { key: 'appAd', label: 'TapApp广告统计' },
];

/** TapPC广告投放素材分布 Treemap 颜色库 */
const AD_MATERIAL_COLORS = [
  '#7A8B99', '#9CAF9F', '#C4A4A4', '#D6C9B0', '#9B93A8',
  '#8FA3B0', '#7D8F7B', '#D0B4B4', '#BFAE8E', '#B4AEC0',
  '#5C6B7A', '#8A8F6B', '#B08B8B', '#C9B79C', '#A0A0A0',
  '#A9BAC4', '#A8BFAE', '#C9B6C0', '#A6947E', '#B0AAA4',
  '#6B7C8C', '#5F6F5E', '#B9A2AE', '#D8CFC0', '#6E6E6E',
];

/** 百分比格式化（保留2位小数） */
const pct2 = (v) => (v == null ? '-' : `${v.toFixed(2)}%`);

/** 游戏名称截断：最多10个字，超出用...代替 */
const truncateName = (name) => {
  const s = name || '';
  return s.length > 10 ? s.slice(0, 10) + '...' : (s || '-');
};

/** 广告投放比进度条颜色（分段：<25 / 25-50 / 50-75 / >=75） */
const adDeliveryRateColor = (rate) => {
  if (rate == null) return '#dee2e6';
  if (rate < 25) return '#9CAF9F';
  if (rate < 50) return '#D6C9B0';
  if (rate < 75) return '#D0B4B4';
  return '#B08B8B';
};

/** 百分比进度条（分段颜色 + 数字居中显示在进度条上） */
const RateBar = ({ rate }) => {
  if (rate == null) return <span className="text-muted">-</span>;
  const pct = Math.min(100, Math.max(0, rate));
  return (
    <div className="progress position-relative" style={{ height: 18, backgroundColor: '#e9ecef' }}>
      <div className="progress-bar" style={{ width: `${pct}%`, backgroundColor: adDeliveryRateColor(rate) }} />
      <span className="position-absolute top-50 start-50 translate-middle" style={{ fontSize: 11, fontWeight: 600, color: '#333', whiteSpace: 'nowrap' }}>
        {rate}%
      </span>
    </div>
  );
};

/** 平台堆叠 bar（iOS + Android，总数居中，悬停显示平台明细） */
const PlatformBar = ({ ios = 0, android = 0 }) => {
  const [pos, setPos] = useState(null);
  const i = Number(ios) || 0;
  const a = Number(android) || 0;
  const total = i + a;
  if (total === 0) return <span className="text-muted">-</span>;
  const iosPct = (i / total) * 100;
  const androidPct = (a / total) * 100;
  return (
    <div
      className="position-relative"
      style={{ height: 18, backgroundColor: '#e9ecef', borderRadius: 4, overflow: 'hidden' }}
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPos({ x: rect.left + rect.width / 2, y: rect.bottom + 6 });
      }}
      onMouseLeave={() => setPos(null)}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${iosPct}%`, backgroundColor: '#A9BAC4' }} />
      <div style={{ position: 'absolute', left: `${iosPct}%`, top: 0, bottom: 0, width: `${androidPct}%`, backgroundColor: '#9CAF9F' }} />
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#333', pointerEvents: 'none' }}>
        {total}
      </span>
      {pos && (
        <div style={{
          position: 'fixed', left: pos.x, top: pos.y, transform: 'translateX(-50%)',
          background: 'rgba(33,37,41,0.95)', color: '#fff', padding: '6px 8px',
          borderRadius: 6, fontSize: 12, lineHeight: 1.6, whiteSpace: 'nowrap', zIndex: 2000, pointerEvents: 'none',
        }}>
          iOS：{i}　Android：{a}
        </div>
      )}
    </div>
  );
};

/** 每日新发现游戏列表列配置 */
const AD_GAME_LIST_COLUMNS = [
  { header: 'APPID', accessor: (r) => r.appId, render: (r) => <span className="text-muted small">{r.appId}</span> },
  { header: '游戏名称', width: 170, accessor: (r) => r.appName, render: (r) => <span className="fw-semibold" title={r.appName || undefined} style={{ whiteSpace: 'nowrap' }}>{truncateName(r.appName)}</span> },
  { header: '曝光次数', align: 'end', accessor: (r) => r.showCnt, render: (r) => <span>{formatNumber(r.showCnt)}</span> },
  { header: '广告投放次数', align: 'end', accessor: (r) => r.adCnt, render: (r) => <span>{formatNumber(r.adCnt)}</span> },
  { header: '广告投放比', align: 'end', accessor: (r) => r.adDeliveryRate, render: (r) => <span>{pct2(r.adDeliveryRate)}</span> },
  { header: '广告贡献比例', align: 'end', accessor: (r) => r.adContributionRate, render: (r) => <span>{pct2(r.adContributionRate)}</span> },
  { header: '广告加载率', align: 'end', accessor: (r) => r.adLoadingRate, render: (r) => <span>{pct2(r.adLoadingRate)}</span> },
];

/** TapApp首页找游戏标签列配色（取自 AD_MATERIAL_COLORS 色库） */
const APP_AD_TAG_COLORS = {
  tag1: '#7A8B99',
  tag2: '#7D8F7B',
  tag3: '#B08B8B',
};

/** TapApp首页找游戏曝光游戏明细列表列配置（在游戏名称后加标签列，tag1/tag2/tag3 分级突出显示） */
const TAPAPP_AD_GAME_LIST_COLUMNS = [
  { header: 'APPID', accessor: (r) => r.appId, render: (r) => <span className="text-muted small">{r.appId}</span> },
  { header: '游戏名称', width: 170, accessor: (r) => r.appName, render: (r) => <span className="fw-semibold" title={r.appName || undefined} style={{ whiteSpace: 'nowrap' }}>{truncateName(r.appName)}</span> },
  {
    header: '标签',
    accessor: (r) => [r.tag1, r.tag2, r.tag3].filter(Boolean).join(' '),
    render: (r) => (
      <div className="d-flex flex-wrap gap-1">
        {r.tag1 && <span className="badge" style={{ backgroundColor: APP_AD_TAG_COLORS.tag1, color: '#fff' }}>{r.tag1}</span>}
        {r.tag2 && <span className="badge" style={{ backgroundColor: APP_AD_TAG_COLORS.tag2, color: '#fff' }}>{r.tag2}</span>}
        {r.tag3 && <span className="badge" style={{ backgroundColor: APP_AD_TAG_COLORS.tag3, color: '#fff' }}>{r.tag3}</span>}
        {!r.tag1 && !r.tag2 && !r.tag3 && <span className="text-muted">-</span>}
      </div>
    ),
  },
  {
    header: '游戏类型',
    accessor: (r) => r.distributionType,
    render: (r) => {
      const dt = r.distributionType;
      if (dt == null || dt <= 0) return <span className="text-muted">-</span>;
      return (
        <div className="d-flex flex-wrap gap-1">
          <span className="badge" style={{ backgroundColor: '#9B93A8', color: '#fff' }}>创意工坊</span>
          {dt === 2 && <span className="badge" style={{ backgroundColor: '#7D8F7B', color: '#fff' }}>TapTap制造</span>}
        </div>
      );
    },
  },
  { header: '曝光次数', align: 'center', width: 140, help: '指命中一次系统采集，则为一次曝光', accessor: (r) => r.showCnt, render: (r) => <PlatformBar ios={r.iosShowCnt} android={r.androidShowCnt} /> },
  { header: '广告投放次数', align: 'center', width: 140, help: '指命中一次系统采集，且本次命中的素材中带有AD标志，则为一次广告投放', accessor: (r) => r.adCnt, render: (r) => <PlatformBar ios={r.iosAdCnt} android={r.androidAdCnt} /> },
  { header: '投放趋势', align: 'center', help: '为最近7天内每日投放的趋势，x轴为每日时间，y轴为每日的广告投放次数', render: (r) => <Sparkline data={r.trend || []} labels={r.trendLabels || []} width={120} height={32} /> },
  { header: '广告投放比', align: 'center', width: 140, help: '广告投放比=广告投放次数/曝光次数', accessor: (r) => r.adDeliveryRate, render: (r) => <RateBar rate={r.adDeliveryRate} /> },
  { header: '广告贡献比例', align: 'center', width: 140, help: '广告贡献比例=广告投放次数/总广告投放数', accessor: (r) => r.adContributionRate, render: (r) => <RateBar rate={r.adContributionRate} /> },
  { header: '广告加载率', align: 'center', width: 140, help: '广告加载率=广告投放次数/总曝光次数', accessor: (r) => r.adLoadingRate, render: (r) => <RateBar rate={r.adLoadingRate} /> },
];

/** TapApp搜索页广告来源分类 */
const SEARCH_SOURCES = [
  { key: 'discovery', label: '搜索发现' },
  { key: 'hot_search', label: '热搜' },
  { key: 'hot_spot', label: '热点' },
];

/** TapApp搜索页关键词统计表格列配置 */
const TAPAPP_SEARCH_KEYWORD_COLUMNS = [
  { header: '关键字', accessor: (r) => r.keyword, render: (r) => <span className="fw-semibold">{r.keyword}</span> },
  { header: '曝光次数', align: 'center', width: 140, accessor: (r) => r.showCnt, render: (r) => <PlatformBar ios={r.iosShowCnt} android={r.androidShowCnt} /> },
  { header: '广告投放次数', align: 'center', width: 140, accessor: (r) => r.adCnt, render: (r) => <PlatformBar ios={r.iosAdCnt} android={r.androidAdCnt} /> },
  { header: '投放趋势', align: 'center', render: (r) => <Sparkline data={r.trend || []} labels={r.trendLabels || []} width={120} height={32} /> },
  { header: '广告投放比', align: 'center', width: 140, accessor: (r) => r.adDeliveryRate, render: (r) => <RateBar rate={r.adDeliveryRate} /> },
  { header: '广告贡献比', align: 'center', width: 140, accessor: (r) => r.adContributionRate, render: (r) => <RateBar rate={r.adContributionRate} /> },
  { header: '广告加载率', align: 'center', width: 140, accessor: (r) => r.adLoadingRate, render: (r) => <RateBar rate={r.adLoadingRate} /> },
];

/** 月趋势拆分图（平台/AI/TapMaker）配置 */
const MONTHLY_BREAKDOWN_CHARTS = [
  { key: 'platform', title: '热门游戏TopN下载月趋势(平台) — 最近12个月' },
  { key: 'ai', title: '热门游戏TopN下载月趋势(AI) — 最近12个月' },
  { key: 'tapmaker', title: '热门游戏TopN下载月趋势(TapMaker) — 最近12个月' },
];

/** 追踪的游戏分布拆分图（平台/AI/TapMaker）配置 */
const DISTRIBUTION_CHARTS = [
  { key: 'platform', title: '追踪的游戏分布(平台)' },
  { key: 'ai', title: '追踪的游戏分布(AI)' },
  { key: 'tapmaker', title: '追踪的游戏分布(TapMaker)' },
];

/** 下载Top25明细拆分表配置 */
const TOP25_DETAIL_TABLES = {
  app: { title: '下载Top25明细(APP)', hourFilter: "refer = 'app'", dayFilter: 'app_download_count > 0', orderBy: 'app_download_count' },
  pc: { title: '下载Top25明细(PC)', hourFilter: "refer = 'pc'", dayFilter: 'pc_download_count > 0', orderBy: 'pc_download_count' },
  ai: { title: '下载Top25明细(AI)', hourFilter: 'distribution_type > 0', dayFilter: 'ai_download_count > 0', orderBy: 'ai_download_count' },
  noneMaker: { title: '下载Top25明细(非TapMaker)', hourFilter: 'distribution_type = 1', dayFilter: 'ai_none_maker_download_count > 0', orderBy: 'ai_none_maker_download_count' },
  maker: { title: '下载Top25明细(TapMaker)', hourFilter: 'distribution_type = 2', dayFilter: 'ai_maker_download_count > 0', orderBy: 'ai_maker_download_count' },
};

/** 下载Top25明细表格列（游戏名称从全局映射获取） */
const TOP25_DETAIL_COLUMNS = (gameNameMap) => [
  { header: 'AppID', accessor: (r) => r.appId, render: (r) => <span className="text-muted small">{r.appId}</span> },
  { header: '游戏名称', width: 170, accessor: (r) => gameNameMap?.[String(r.appId)] || '', render: (r) => { const name = gameNameMap?.[String(r.appId)] || ''; return <span className="fw-semibold" title={name || undefined} style={{ whiteSpace: 'nowrap' }}>{truncateName(name)}</span>; } },
  { header: '下载数', align: 'end', accessor: (r) => r.downloadCount, render: (r) => <span className="fw-semibold">{formatNumber(r.downloadCount)}</span> },
  { header: '时间', accessor: (r) => r.crawledAt, render: (r) => <span className="text-muted small">{r.crawledAt}</span> },
];

/** 下载Top25明细查询 hook（按窗口 + 过滤条件） */
function useTop25DetailQuery(key, table, selectedTable, selectedWindow) {
  return useSqlQuery(
    `taptap-top25-${key}`,
    () => buildTop25DetailSql(selectedTable, selectedWindow, table.hourFilter, table.dayFilter, table.orderBy),
    [selectedTable, selectedWindow],
    transformTop25Detail
  );
}

export default function TapTapReport() {
  const [appId, setAppId] = useState('');
  const [days, setDays] = useState(1);
  const [selectedTable, setSelectedTable] = useState('dws_taptap_download_hourly');
  const [selectedWindow, setSelectedWindow] = useState(() => formatNowWindow('hour'));
  const [chartGroup, setChartGroup] = useState('download');
  const validAppId = /^\d+$/.test(appId);

  const hotListQuery = useSqlQuery('taptap-hot-list-trend', buildAggregateSql, [], transformAggregate);
  const detailQuery = useSqlQuery('taptap-game-detail', () => buildDetailSql(appId, days), [appId, days], transformDetail, { enabled: validAppId });
  const summaryQuery = useSqlQuery('taptap-game-summary', () => buildSummarySql(appId, days), [appId, days], transformKpiSnapshot, { enabled: validAppId });
  const dailyTrendQuery = useSqlQuery('taptap-daily-trend', buildDailyTrendSql, [], transformDailyTrend);
  const monthlyBreakdownQuery = useSqlQuery('taptap-monthly-breakdown', buildMonthlyBreakdownSql, [], transformMonthlyBreakdown);
  const distributionByWindowQuery = useSqlQuery('taptap-distribution-by-window', () => buildDistributionByWindowSql(selectedTable, selectedWindow), [selectedTable, selectedWindow], transformDistributionByWindow);
  const gameNameQuery = useSqlQuery('taptap-game-name-map', buildGameNameSql, [], transformGameNameMap);
  const onlinePlayersTrendQuery = useSqlQuery('taptap-online-players-trend', buildOnlinePlayersTrendSql, [], transformOnlinePlayersTrend);
  const onlinePlayersStatsQuery = useSqlQuery('taptap-online-players-stats', buildOnlinePlayersStatsSql, [], transformOnlinePlayersStats);
  const newestDateQuery = useSqlQuery('taptap-newest-date', buildNewestDateSql, [], transformNewestDate);
  const onlinePlayersDistributionQuery = useSqlQuery('taptap-online-players-distribution', () => buildOnlinePlayersDistributionSql(newestDateQuery.data), [newestDateQuery.data], transformOnlinePlayersDistribution, { enabled: !!newestDateQuery.data });
  const onlinePlayersTopNTrendQuery = useSqlQuery('taptap-online-players-topn-trend', buildOnlinePlayersTopNTrendSql, [], transformOnlinePlayersTopNTrend);
  const onlinePlayersSourceNewestQuery = useSqlQuery('taptap-online-players-source-newest', buildOnlinePlayersSourceNewestSql, [], transformNewestDate);
  const onlinePlayersSourceQuery = useSqlQuery('taptap-online-players-source', () => buildOnlinePlayersSourceSql(onlinePlayersSourceNewestQuery.data), [onlinePlayersSourceNewestQuery.data], transformOnlinePlayersSource, { enabled: !!onlinePlayersSourceNewestQuery.data });
  const onlinePlayersSourceGamesQuery = useSqlQuery('taptap-online-players-source-games', () => buildOnlinePlayersSourceGamesSql(onlinePlayersSourceNewestQuery.data), [onlinePlayersSourceNewestQuery.data], transformOnlinePlayersSourceGames, { enabled: !!onlinePlayersSourceNewestQuery.data });
  const topNProportionQuery = useSqlQuery('taptap-topn-proportion', () => buildTopNProportionSql(newestDateQuery.data), [newestDateQuery.data], transformTopNProportion, { enabled: !!newestDateQuery.data });
  const adNewPositionStatsQuery = useSqlQuery('taptap-ad-new-position-stats', buildAdNewPositionStatsSql, [], transformAdNewPositionStats);
  const adMaterialTagsQuery = useSqlQuery('taptap-ad-material-tags', buildAdMaterialTagsSql, [], transformAdMaterialTags);
  const adMaterialGamesQuery = useSqlQuery('taptap-ad-material-games', buildAdMaterialGamesSql, [], transformAdMaterialGames);
  const adTotalStatsQuery = useSqlQuery('taptap-ad-total-stats', buildAdTotalStatsSql, [], transformAdTotalStats);
  const adGameListQuery = useSqlQuery('taptap-ad-game-list', buildAdGameListSql, [], (rows) => transformAdGameList(rows, adTotalStatsQuery.data), { enabled: !!adTotalStatsQuery.data });
  const adLoadingRateTrendQuery = useSqlQuery('taptap-ad-loading-rate-trend', buildAdLoadingRateTrendSql, [], transformAdLoadingRateTrend);
  const tapAppAdNewPositionStatsQuery = useSqlQuery('taptap-app-ad-new-position-stats', buildTapAppAdNewPositionStatsSql, [], transformTapAppAdNewPositionStats);
  const tapAppAdMaterialTagsQuery = useSqlQuery('taptap-app-ad-material-tags', buildTapAppAdMaterialTagsSql, [], transformAdMaterialTags);
  const tapAppAdMaterialGamesQuery = useSqlQuery('taptap-app-ad-material-games', buildTapAppAdMaterialGamesSql, [], transformAdMaterialGames);
  const tapAppAdTotalStatsQuery = useSqlQuery('taptap-app-ad-total-stats', buildTapAppAdTotalStatsSql, [], transformAdTotalStats);
  const tapAppAdGameListQuery = useSqlQuery('taptap-app-ad-game-list', buildTapAppAdGameListSql, [], (rows) => transformAdGameList(rows, tapAppAdTotalStatsQuery.data), { enabled: !!tapAppAdTotalStatsQuery.data });
  const tapAppAdGameDailyTrendQuery = useSqlQuery('taptap-app-ad-game-daily-trend', buildTapAppAdGameDailyTrendSql, [], transformTapAppAdGameDailyTrend);
  const tapAppAdLoadingRateTrendQuery = useSqlQuery('taptap-app-ad-loading-rate-trend', buildTapAppAdLoadingRateTrendSql, [], transformAdLoadingRateTrend);
  const tapAppSearchPositionStatsQuery = useSqlQuery('taptap-app-search-position-stats', buildTapAppSearchPositionStatsSql, [], transformTapAppSearchPositionStats);
  const tapAppSearchLoadingRateTrendQuery = useSqlQuery('taptap-app-search-loading-rate-trend', buildTapAppSearchLoadingRateTrendSql, [], transformTapAppSearchLoadingRateTrend);
  const tapAppSearchKeywordStatsQuery = useSqlQuery('taptap-app-search-keyword-stats', buildTapAppSearchKeywordStatsSql, [], transformTapAppSearchKeywordStats);
  const tapAppSearchKeywordDailyTrendQuery = useSqlQuery('taptap-app-search-keyword-daily-trend', buildTapAppSearchKeywordDailyTrendSql, [], transformTapAppSearchKeywordDailyTrend);
  const tapAppSearchTotalStatsQuery = useSqlQuery('taptap-app-search-total-stats', buildTapAppSearchTotalStatsSql, [], transformTapAppSearchTotalStats);
  const tapAppSearchKeywordRows = useMemo(() => {
    const statsData = tapAppSearchKeywordStatsQuery.data;
    const trendData = tapAppSearchKeywordDailyTrendQuery.data;
    if (!statsData) return { discovery: [], hot_search: [], hot_spot: [] };
    return Object.fromEntries(SEARCH_SOURCES.map((src) => {
      const rows = statsData[src.key]?.rows || [];
      const days = trendData?.[src.key]?.days || [];
      const byKeyword = trendData?.[src.key]?.byKeyword || {};
      return [src.key, rows.map((r) => ({
        ...r,
        trend: days.map((d) => byKeyword[r.keyword]?.[d] ?? 0),
        trendLabels: days,
      }))];
    }));
  }, [tapAppSearchKeywordStatsQuery.data, tapAppSearchKeywordDailyTrendQuery.data]);
  const tapAppAdGameRows = useMemo(() => {
    const list = tapAppAdGameListQuery.data?.rows || [];
    const trendData = tapAppAdGameDailyTrendQuery.data;
    const days = trendData?.days || [];
    const byApp = trendData?.byApp || {};
    return list.map((r) => ({ ...r, trend: days.map((d) => byApp[r.appId]?.[d] ?? 0), trendLabels: days }));
  }, [tapAppAdGameListQuery.data, tapAppAdGameDailyTrendQuery.data]);

  const top25DetailQueries = {
    app: useTop25DetailQuery('app', TOP25_DETAIL_TABLES.app, selectedTable, selectedWindow),
    pc: useTop25DetailQuery('pc', TOP25_DETAIL_TABLES.pc, selectedTable, selectedWindow),
    ai: useTop25DetailQuery('ai', TOP25_DETAIL_TABLES.ai, selectedTable, selectedWindow),
    noneMaker: useTop25DetailQuery('noneMaker', TOP25_DETAIL_TABLES.noneMaker, selectedTable, selectedWindow),
    maker: useTop25DetailQuery('maker', TOP25_DETAIL_TABLES.maker, selectedTable, selectedWindow),
  };

  // 数据最新时间加载后，小时选项的统计窗口默认值同步为最新数据时间，避免数据更新期间空白
  useEffect(() => {
    if (selectedTable === 'dws_taptap_download_hourly' && newestDateQuery.data) {
      setSelectedWindow(newestDateQuery.data);
    }
  }, [newestDateQuery.data, selectedTable]);

  const detailEmpty = !validAppId || (detailQuery.isSuccess && !detailQuery.data?.series?.length);

  return (
    <div className="container-fluid p-4">
      <h2 className="fw-bold mb-4">
        <i className="bi bi-controller text-primary me-2"></i>
        TapTap 报表
      </h2>

      {/* 数据图表选择 */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-0 fw-semibold">数据图表选择</div>
        <div className="card-body">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {CHART_GROUPS.map((g) => (
              <button
                key={g.key}
                type="button"
                className={`btn btn-sm ${chartGroup === g.key ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setChartGroup(g.key)}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TapTap下载统计 */}
      {chartGroup === 'download' && (
        <>
      {/* 热门游戏TopN下载趋势（聚合） */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-0 fw-semibold">热门游戏TopN下载趋势 — 近24小时（增量）</div>
        <div className="card-body">
          <BarChart
            series={hotListQuery.data?.series || []}
            loading={hotListQuery.isLoading}
            error={hotListQuery.error?.message}
            height={675}
            stacked
            totalLabels
            xaxisOverrides={hotListQuery.data?.categories ? { categories: hotListQuery.data.categories, labels: { rotate: -45 } } : {}}
            yaxisOverrides={{
              title: { text: '增量下载数' },
              labels: {
                formatter: (v) => formatCompactNumber(v),
              },
            }} />
        </div>
      </div>

      {/* 热门游戏TopN下载月趋势（平台/AI/TapMaker 并排） */}
      <div className="row g-3 mb-4">
        {MONTHLY_BREAKDOWN_CHARTS.map((c) => (
          <div className="col-12 col-md-4" key={c.key}>
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 fw-semibold">{c.title}</div>
              <div className="card-body">
                <BarChart
                  series={monthlyBreakdownQuery.data?.[c.key] || []}
                  loading={monthlyBreakdownQuery.isLoading}
                  error={monthlyBreakdownQuery.error?.message}
                  height={350}
                  stacked
                  totalLabels
                  shared
                  xaxisOverrides={monthlyBreakdownQuery.data?.categories ? { categories: monthlyBreakdownQuery.data.categories, labels: { rotate: -45 } } : {}}
                  yaxisOverrides={{ title: { text: '下载数' }, labels: { formatter: (v) => formatCompactNumber(v) } }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 热门游戏TopN下载日趋势 */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-0 fw-semibold">热门游戏TopN下载日趋势 — 最近30天</div>
        <div className="card-body">
          <LineChart
            series={dailyTrendQuery.data?.series || []}
            loading={dailyTrendQuery.isLoading}
            error={dailyTrendQuery.error?.message}
            height={350}
            strokeWidth={2}
            strokeDashArray={[0, 5, 5, 5, 5, 5, 5]}
            markers={3}
            shared
            xaxisOverrides={dailyTrendQuery.data?.categories ? { type: 'category', categories: dailyTrendQuery.data.categories, labels: { rotate: -45 } } : {}}
            yaxisOverrides={{ title: { text: '下载数' }, labels: { formatter: (v) => formatCompactNumber(v) } }} />
        </div>
      </div>

      {/* 下载Top25明细查询条件 */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-0 fw-semibold">下载Top25明细查询条件</div>
        <div className="card-body">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="text-muted small">窗口类型</span>
            {WINDOW_TYPES.map((w) => (
              <button
                key={w.table}
                type="button"
                className={`btn btn-sm ${selectedTable === w.table ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => {
                  setSelectedTable(w.table);
                  setSelectedWindow(w.granularity === 'hour' && newestDateQuery.data ? newestDateQuery.data : formatNowWindow(w.granularity));
                }}
              >
                {w.label}
              </button>
            ))}
            <span className="ms-3 text-muted small">统计窗口</span>
            <input
              type="text"
              className="form-control form-control-sm"
              style={{ width: 180 }}
              value={selectedWindow}
              onChange={(e) => setSelectedWindow(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 追踪的游戏分布（平台/AI/TapMaker 并排） */}
      <div className="row g-3 mb-4">
        {DISTRIBUTION_CHARTS.map((c) => (
          <div className="col-12 col-md-4" key={c.key}>
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 fw-semibold">{c.title}</div>
              <div className="card-body d-flex flex-column align-items-center justify-content-center">
                <PieChart
                  series={distributionByWindowQuery.data?.[c.key]?.series || []}
                  labels={distributionByWindowQuery.data?.[c.key]?.labels || []}
                  loading={distributionByWindowQuery.isLoading}
                  error={distributionByWindowQuery.error?.message}
                  height={300}
                  donut
                  totalLabel={distributionByWindowQuery.data?.[c.key]?.totalLabel}
                  totalValue={distributionByWindowQuery.data?.[c.key]?.totalValue}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 下载Top25明细（APP/PC） */}
      <div className="row g-3 mb-4">
        {['app', 'pc'].map((key) => (
          <div className="col-12 col-md-6" key={key}>
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 fw-semibold">{TOP25_DETAIL_TABLES[key].title}</div>
              <DataTable rows={top25DetailQueries[key].data?.rows || []} columns={TOP25_DETAIL_COLUMNS(gameNameQuery.data)} />
            </div>
          </div>
        ))}
      </div>

      {/* 下载Top25明细（AI/非TapMaker/TapMaker） */}
      <div className="row g-3 mb-4">
        {['ai', 'noneMaker', 'maker'].map((key) => (
          <div className="col-12 col-md-4" key={key}>
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 fw-semibold">{TOP25_DETAIL_TABLES[key].title}</div>
              <DataTable rows={top25DetailQueries[key].data?.rows || []} columns={TOP25_DETAIL_COLUMNS(gameNameQuery.data)} />
            </div>
          </div>
        ))}
      </div>

      {/* 游戏统计详细信息查询条件 */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-0 fw-semibold">游戏统计详细信息查询条件</div>
        <div className="card-body">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <label className="form-label small text-muted mb-0">AppID</label>
            <input
              type="text"
              className="form-control form-control-sm"
              style={{ width: 180 }}
              placeholder="请输入appId"
              value={appId}
              onChange={(e) => setAppId(e.target.value.trim())}
            />
            <span className="ms-3 text-muted small">时间范围</span>
            {TIME_RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                className={`btn btn-sm ${days === r.days ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setDays(r.days)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 游戏汇总指标（受查询条件控制） */}
      <KpiRow data={summaryQuery.data} />

      {/* 游戏详情趋势（受查询条件控制） */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-0 fw-semibold">
          游戏详情趋势{detailQuery.data?.appName ? ` — ${detailQuery.data.appName}` : ''}
        </div>
        <div className="card-body">
          {detailEmpty ? (
            <div className="text-center text-muted py-5">
              <i className="bi bi-inbox fs-1 d-block mb-2"></i>
              暂无数据
            </div>
          ) : (
            <LineChart
              series={detailQuery.data?.series || []}
              loading={detailQuery.isLoading}
              error={detailQuery.error?.message}
              height={400}
              strokeWidth={2}
              strokeDashArray={[5, 5, 0]}
              shared
              xaxisOverrides={detailQuery.data?.categories ? { type: 'category', categories: detailQuery.data.categories, labels: { rotate: -45 } } : {}}
              yaxisOverrides={{ title: { text: '下载数' }, labels: { formatter: (v) => formatCompactNumber(v) } }} />
          )}
        </div>
      </div>
        </>
      )}

      {/* TapPC在线人数统计 */}
      {chartGroup === 'online' && (
        <>
      {/* TapPC热玩游戏榜在线人数趋势（75%） + TopN游戏占比（25%） */}
      <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
        {/* 趋势（左，75%） */}
        <div style={{ flex: '0 0 70%', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <div className="fw-semibold">TapPC热玩游戏榜在线人数趋势</div>
              <div className="text-muted small">历史统计区间为 [{onlinePlayersStatsQuery.data?.startCrawledAt ?? ''} - {onlinePlayersStatsQuery.data?.endCrawledAt ?? ''}]</div>
            </div>
            <div className="card-body">
              <LineChart
                series={onlinePlayersTrendQuery.data?.series || []}
                loading={onlinePlayersTrendQuery.isLoading}
                error={onlinePlayersTrendQuery.error?.message}
                height={500}
                strokeWidth={[4, 2, 2, 2, 2, 2]}
                strokeDashArray={[0, 5, 5, 5, 5, 5]}
                shared
                xaxisOverrides={onlinePlayersTrendQuery.data?.categories ? { type: 'category', categories: onlinePlayersTrendQuery.data.categories, labels: { rotate: -45 } } : {}}
                yaxisOverrides={{ title: { text: '在线人数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
                yaxisAnnotations={onlinePlayersStatsQuery.data ? [
                  { y: onlinePlayersStatsQuery.data.maxOnlinePlayers, color: '#421243', position: 'center', label: `历史峰值最高值 (${formatNumber(onlinePlayersStatsQuery.data.maxOnlinePlayers)})` },
                  { y: onlinePlayersStatsQuery.data.minOnlinePlayers, color: '#C0ADDB', position: 'center', label: `历史峰值最低值 (${formatNumber(onlinePlayersStatsQuery.data.minOnlinePlayers)})` },
                  { y: onlinePlayersStatsQuery.data.avgOnlinePlayers, color: '#7F94B0', position: 'center', label: `历史峰值均值 (${formatNumber(onlinePlayersStatsQuery.data.avgOnlinePlayers)})` },
                ] : []} />
            </div>
          </div>
        </div>
        {/* TopN游戏占比（右，25%） */}
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <div className="fw-semibold">TopN游戏占比</div>
              <div className="text-muted small">最新统计窗口为 - {newestDateQuery.data || ''}</div>
            </div>
            <div className="card-body">
              <MixedChart
                series={topNProportionQuery.data?.series || []}
                loading={topNProportionQuery.isLoading}
                error={topNProportionQuery.error?.message}
                height={500}
                toolbar={false}
                colors={['#4361ee', '#e71d36']}
                strokeWidths={[0, 2]}
                tooltipY={(v, yi) => (yi === 1 ? v.toFixed(2) + '%' : v.toLocaleString('zh-CN'))}
                xaxisOverrides={topNProportionQuery.data?.categories ? { type: 'category', categories: topNProportionQuery.data.categories, labels: { rotate: -45 } } : {}}
                yaxisLeft={{ title: { text: '在线人数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
                yaxisRight={{ title: { text: '占比 (%)' }, min: 0, max: 100, labels: { formatter: (v) => v.toFixed(2) + '%' } }} />
            </div>
          </div>
        </div>
      </div>

      {/* 游戏数占比（30%） + TapPC游戏在线人数分布图（70%） */}
      <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
        {/* 游戏数占比（左，30%） */}
        <div style={{ flex: '0 0 30%', minWidth: 240 }}>
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <div className="fw-semibold">游戏数占比</div>
              <div className="text-muted small">最新统计窗口为 - {newestDateQuery.data || ''}</div>
            </div>
            <div className="card-body d-flex flex-column align-items-center justify-content-center">
              <PieChart
                series={onlinePlayersDistributionQuery.data?.series || []}
                labels={onlinePlayersDistributionQuery.data?.labels || []}
                colors={onlinePlayersDistributionQuery.data?.colors || []}
                loading={onlinePlayersDistributionQuery.isLoading}
                error={onlinePlayersDistributionQuery.error?.message}
                height={500}
                donut
                totalLabel="总游戏数"
                toolbar={false}
                dataLabelsOffset={45}
                minAngleToShowLabel={0}
              />
            </div>
          </div>
        </div>
        {/* TapPC游戏在线人数分布图（右，70%） */}
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <div className="fw-semibold">TapPC游戏在线人数分布图</div>
              <div className="text-muted small">最新统计窗口为 - {onlinePlayersSourceNewestQuery.data || ''}</div>
            </div>
            <div className="card-body">
              <TreemapChart
                key={onlinePlayersSourceNewestQuery.data}
                series={[{ name: '在线人数', data: onlinePlayersSourceQuery.data?.data || [] }]}
                loading={onlinePlayersSourceQuery.isLoading}
                error={onlinePlayersSourceQuery.error?.message}
                height={500}
                colors={onlinePlayersSourceQuery.data?.colors || []}
                distributed
                drilldown={{
                  enabled: true,
                  breadcrumb: { show: true, position: 'top-left', rootLabel: '在线人数分布' },
                  series: ONLINE_PLAYERS_BUCKETS.map((b) => ({
                    id: b.label,
                    name: b.label,
                    data: onlinePlayersSourceGamesQuery.data?.[b.label] || [],
                    colors: [b.color],
                    plotOptions: { treemap: { distributed: false, enableShades: true, colorScale: { min: 0, max: b.ref } } },
                  })),
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* TapPC在线人数TopN趋势图 */}
      <div className="row g-3 mb-4">
        {onlinePlayersTopNTrendQuery.data?.map((card) => (
          <div className="col-12 col-md-3" key={card.appId}>
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 fw-semibold text-truncate">
                {card.appName || '未知'}({card.appId})
              </div>
              <div className="card-body">
                <LineChart
                  series={card.series || []}
                  height={220}
                  xaxisOverrides={{ type: 'category', categories: card.categories, labels: { rotate: -90, rotateAlways: true, offsetY: 10, style: { fontSize: '8px' }, formatter: (value) => String(value).slice(-8) } }}
                  yaxisOverrides={{ title: { text: '在线人数' }, labels: { formatter: (v) => formatCompactNumber(v) } }} />
              </div>
            </div>
          </div>
        ))}
      </div>
        </>
      )}

      {/* TapPC广告统计 */}
      {chartGroup === 'ad' && (
        <>
        <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
          <div className="card-header bg-white border-0">
            <div className="fw-semibold">【每日新发现】广告位每日追踪 — 最近7天</div>
            <div className="text-muted small">行=广告位(position)，列=日期(crawled_at)，值=广告加载率(ad_loading_rate)</div>
          </div>
          <div className="card-body">
            <HeatmapChart
              series={adNewPositionStatsQuery.data?.series || []}
              loading={adNewPositionStatsQuery.isLoading}
              error={adNewPositionStatsQuery.error?.message}
              height={500}
              colorScale={[
                { from: 0, to: 0.01, name: '0%', color: '#D8D0E4' },
                { from: 0.01, to: 0.34, name: '1-33%', color: '#B39BC8' },
                { from: 0.34, to: 0.68, name: '34-67%', color: '#8B6FAD' },
                { from: 0.68, to: 1.01, name: '68-100%', color: '#421243' },
              ]}
              valueFormatter={(val) => (val > 0 ? `${Math.round(val * 100)}%` : '')}
              xaxisOverrides={adNewPositionStatsQuery.data?.categories ? { categories: adNewPositionStatsQuery.data.categories } : {}}
              yaxisReversed
            />
          </div>
        </div>
          </div>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
          <div className="card-header bg-white border-0">
            <div className="fw-semibold">【每日新发现】素材标签追踪 — 最近7天</div>
            <div className="text-muted small">第一层=大类(tag_1/tag_2/tag_3 合并)，值=广告加载率；点击下钻查看具体游戏(app_id)</div>
          </div>
          <div className="card-body">
            <TreemapChart
              key={adMaterialTagsQuery.data?.tags?.join(',') || 'empty'}
              series={[{ name: '广告加载率', data: adMaterialTagsQuery.data?.data || [] }]}
              loading={adMaterialTagsQuery.isLoading}
              error={adMaterialTagsQuery.error?.message}
              height={500}
              distributed
              colors={AD_MATERIAL_COLORS}
              dataLabelsFormatter={(val, opts) => {
                const y = Number(opts?.value ?? 0);
                const seriesName = opts?.w?.config?.series?.[opts?.seriesIndex]?.name;
                // 第一层 series name 固定为「广告加载率」→ 显示加载率百分比；第二层(drilldown) → 显示加载次数
                if (seriesName && seriesName !== '广告加载率') {
                  return `${val} ${Math.round(y)}`;
                }
                return `${val} ${Math.round(y * 100)}%`;
              }}
              drilldown={{
                enabled: true,
                breadcrumb: { show: true, position: 'top-left', rootLabel: '素材标签追踪' },
                series: (adMaterialTagsQuery.data?.tags || []).map((tag, idx) => ({
                  id: tag,
                  name: tag,
                  data: adMaterialGamesQuery.data?.byTag?.[tag] || [],
                  colors: [AD_MATERIAL_COLORS[idx % AD_MATERIAL_COLORS.length]],
                  plotOptions: { treemap: { distributed: false, enableShades: true, colorScale: { min: 0, max: adMaterialGamesQuery.data?.maxByTag?.[tag] || 1 } } },
                })),
              }}
            />
          </div>
        </div>
          </div>
        </div>
        <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
          <div className="card-header bg-white border-0 fw-semibold">【每日新发现】曝光游戏明细列表 — 最近7天</div>
          <DataTable rows={adGameListQuery.data?.rows || []} columns={AD_GAME_LIST_COLUMNS} pageSize={10} />
          </div>
          </div>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">【每日新发现】每日广告加载率 — 最近7天</div>
            <div className="card-body">
              <MixedChart
                series={adLoadingRateTrendQuery.data?.series || []}
                loading={adLoadingRateTrendQuery.isLoading}
                error={adLoadingRateTrendQuery.error?.message}
                height={500}
                toolbar={false}
                colors={['#4361ee', '#421243']}
                strokeWidths={[0, 4]}
                dataLabels={{
                  enabled: true,
                  enabledOnSeries: [0],
                  position: 'top',
                  formatter: (val) => formatNumber(val),
                  style: { fontSize: '11px', colors: ['#6c757d'] },
                }}
                tooltipY={(v, yi) => (yi === 1 ? `${(v * 100).toFixed(2)}%` : formatNumber(v))}
                xaxisOverrides={adLoadingRateTrendQuery.data?.categories ? { type: 'category', categories: adLoadingRateTrendQuery.data.categories, labels: { rotate: -45 } } : {}}
                yaxisLeft={{ title: { text: '曝光次数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
                yaxisRight={{ title: { text: '加载率' }, min: 0, max: 0.3, labels: { formatter: (v) => `${(v * 100).toFixed(0)}%` } }}
              />
            </div>
          </div>
          </div>
        </div>

        {/* 分割线：区分“每日新发现”系列与后续图表 */}
        <div className="d-flex align-items-center mb-4" style={{ gap: '1rem' }}>
          <div className="flex-grow-1" style={{ borderTop: '1px dashed #adb5bd' }}></div>
          <span className="text-muted small fw-semibold">每日新发现  End</span>
          <div className="flex-grow-1" style={{ borderTop: '1px dashed #adb5bd' }}></div>
        </div>
        </>
      )}

      {/* TapApp广告统计 */}
      {chartGroup === 'appAd' && (
        <>
        {/* 首页找游戏 · 广告位每日追踪（iOS / Android 并排） */}
        <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
          <div className="card-header bg-white border-0">
            <div className="fw-semibold">【首页找游戏】广告位每日追踪(iOS) — 最近7天</div>
            <div className="text-muted small">行=广告位(position)，列=日期(crawled_at)，值=广告加载率(ad_loading_rate)</div>
          </div>
          <div className="card-body">
            <HeatmapChart
              series={tapAppAdNewPositionStatsQuery.data?.ios?.series || []}
              loading={tapAppAdNewPositionStatsQuery.isLoading}
              error={tapAppAdNewPositionStatsQuery.error?.message}
              height={500}
              colorScale={[
                { from: 0, to: 0.01, name: '0%', color: '#D8D0E4' },
                { from: 0.01, to: 0.34, name: '1-33%', color: '#B39BC8' },
                { from: 0.34, to: 0.68, name: '34-67%', color: '#8B6FAD' },
                { from: 0.68, to: 1.01, name: '68-100%', color: '#421243' },
              ]}
              valueFormatter={(val) => (val > 0 ? `${Math.round(val * 100)}%` : '')}
              xaxisOverrides={tapAppAdNewPositionStatsQuery.data?.ios?.categories ? { categories: tapAppAdNewPositionStatsQuery.data.ios.categories } : {}}
              yaxisReversed
            />
          </div>
        </div>
          </div>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
          <div className="card-header bg-white border-0">
            <div className="fw-semibold">【首页找游戏】广告位每日追踪(Android) — 最近7天</div>
            <div className="text-muted small">行=广告位(position)，列=日期(crawled_at)，值=广告加载率(ad_loading_rate)</div>
          </div>
          <div className="card-body">
            <HeatmapChart
              series={tapAppAdNewPositionStatsQuery.data?.android?.series || []}
              loading={tapAppAdNewPositionStatsQuery.isLoading}
              error={tapAppAdNewPositionStatsQuery.error?.message}
              height={500}
              colorScale={[
                { from: 0, to: 0.01, name: '0%', color: '#D8D0E4' },
                { from: 0.01, to: 0.34, name: '1-33%', color: '#B39BC8' },
                { from: 0.34, to: 0.68, name: '34-67%', color: '#8B6FAD' },
                { from: 0.68, to: 1.01, name: '68-100%', color: '#421243' },
              ]}
              valueFormatter={(val) => (val > 0 ? `${Math.round(val * 100)}%` : '')}
              xaxisOverrides={tapAppAdNewPositionStatsQuery.data?.android?.categories ? { categories: tapAppAdNewPositionStatsQuery.data.android.categories } : {}}
              yaxisReversed
            />
          </div>
        </div>
          </div>
        </div>

        {/* 首页找游戏 · 素材标签追踪 + 每日加载率 */}
        <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
          <div className="card-header bg-white border-0">
            <div className="fw-semibold">【首页找游戏】素材标签追踪 — 最近7天</div>
            <div className="text-muted small">第一层=大类(tag_1/tag_2/tag_3 合并)，值=广告加载率；点击下钻查看具体游戏(app_id)</div>
          </div>
          <div className="card-body">
            <TreemapChart
              key={tapAppAdMaterialTagsQuery.data?.tags?.join(',') || 'empty'}
              series={[{ name: '广告加载率', data: tapAppAdMaterialTagsQuery.data?.data || [] }]}
              loading={tapAppAdMaterialTagsQuery.isLoading}
              error={tapAppAdMaterialTagsQuery.error?.message}
              height={500}
              distributed
              colors={AD_MATERIAL_COLORS}
              dataLabelsFormatter={(val, opts) => {
                const y = Number(opts?.value ?? 0);
                const seriesName = opts?.w?.config?.series?.[opts?.seriesIndex]?.name;
                // 第一层 series name 固定为「广告加载率」→ 显示加载率百分比；第二层(drilldown) → 显示加载次数
                if (seriesName && seriesName !== '广告加载率') {
                  return `${val} ${Math.round(y)}`;
                }
                return `${val} ${Math.round(y * 100)}%`;
              }}
              drilldown={{
                enabled: true,
                breadcrumb: { show: true, position: 'top-left', rootLabel: '素材标签追踪' },
                series: (tapAppAdMaterialTagsQuery.data?.tags || []).map((tag, idx) => ({
                  id: tag,
                  name: tag,
                  data: tapAppAdMaterialGamesQuery.data?.byTag?.[tag] || [],
                  colors: [AD_MATERIAL_COLORS[idx % AD_MATERIAL_COLORS.length]],
                  plotOptions: { treemap: { distributed: false, enableShades: true, colorScale: { min: 0, max: tapAppAdMaterialGamesQuery.data?.maxByTag?.[tag] || 1 } } },
                })),
              }}
            />
          </div>
        </div>
          </div>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">【首页找游戏】每日广告加载率 — 最近7天</div>
            <div className="card-body">
              <MixedChart
                series={tapAppAdLoadingRateTrendQuery.data?.series || []}
                loading={tapAppAdLoadingRateTrendQuery.isLoading}
                error={tapAppAdLoadingRateTrendQuery.error?.message}
                height={500}
                toolbar={false}
                colors={['#4361ee', '#421243']}
                strokeWidths={[0, 4]}
                dataLabels={{
                  enabled: true,
                  enabledOnSeries: [0],
                  position: 'top',
                  formatter: (val) => formatNumber(val),
                  style: { fontSize: '11px', colors: ['#6c757d'] },
                }}
                tooltipY={(v, yi) => (yi === 1 ? `${(v * 100).toFixed(2)}%` : formatNumber(v))}
                xaxisOverrides={tapAppAdLoadingRateTrendQuery.data?.categories ? { type: 'category', categories: tapAppAdLoadingRateTrendQuery.data.categories, labels: { rotate: -45 } } : {}}
                yaxisLeft={{ title: { text: '曝光次数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
                yaxisRight={{ title: { text: '加载率' }, min: 0, max: 0.3, labels: { formatter: (v) => `${(v * 100).toFixed(0)}%` } }}
              />
            </div>
          </div>
          </div>
        </div>

        {/* 首页找游戏 · 曝光游戏明细列表（整行） */}
        <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
          <div className="card-header bg-white border-0">
            <div className="fw-semibold">【首页找游戏】曝光游戏明细列表 — 最近7天</div>
            <div className="text-muted small">记录了TapTap App(IOS+Android2个平台)首页找游戏前20个位置素材广告曝光情况，每2小时自动由系统采集一次。</div>
          </div>
          <DataTable rows={tapAppAdGameRows} columns={TAPAPP_AD_GAME_LIST_COLUMNS} pageSize={10} />
          </div>
          </div>
        </div>

        {/* 分割线：区分“首页找游戏”系列与“搜索页”系列 */}
        <div className="d-flex align-items-center mb-4" style={{ gap: '1rem' }}>
          <div className="flex-grow-1" style={{ borderTop: '1px dashed #adb5bd' }}></div>
          <span className="text-muted small fw-semibold">首页找游戏  End</span>
          <div className="flex-grow-1" style={{ borderTop: '1px dashed #adb5bd' }}></div>
        </div>

        {/* 搜索页广告 · 广告位追踪 + 搜索关键词统计（按来源分类） */}
        {SEARCH_SOURCES.map((src) => (
          <div key={src.key} className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
            <div style={{ flex: '0 0 35%', minWidth: 0 }} className="d-flex flex-column">
              <div className="row g-2 mb-3">
                <div className="col-6">
                  <DashboardCard title="总曝光数" value={tapAppSearchTotalStatsQuery.data?.[src.key]?.totalShowCnt != null ? formatNumber(tapAppSearchTotalStatsQuery.data[src.key].totalShowCnt) : '-'} icon="bi-eye" color="primary" />
                </div>
                <div className="col-6">
                  <DashboardCard title="总投放数" value={tapAppSearchTotalStatsQuery.data?.[src.key]?.totalAdCnt != null ? formatNumber(tapAppSearchTotalStatsQuery.data[src.key].totalAdCnt) : '-'} icon="bi-bullseye" color="success" />
                </div>
                <div className="col-12">
                  <DashboardCard title="广告加载率" value={(() => { const s = tapAppSearchTotalStatsQuery.data?.[src.key]; return s && s.totalShowCnt > 0 ? `${((s.totalAdCnt / s.totalShowCnt) * 100).toFixed(2)}%` : '-'; })()} icon="bi-percent" color="info" />
                </div>
              </div>
            <div className="card border-0 shadow-sm flex-grow-1 d-flex flex-column">
            <div className="card-header bg-white border-0">
              <div className="fw-semibold">【搜索页】广告位追踪({src.label}) — 最近7天</div>
              <div className="text-muted small">行=广告位(position)，列=日期(crawled_at)，值=广告加载率(ad_loading_rate)</div>
            </div>
            <div className="card-body flex-grow-1 d-flex flex-column">
              <HeatmapChart
                series={tapAppSearchPositionStatsQuery.data?.[src.key]?.series || []}
                loading={tapAppSearchPositionStatsQuery.isLoading}
                error={tapAppSearchPositionStatsQuery.error?.message}
                height="100%"
                colorScale={[
                  { from: 0, to: 0.01, name: '0%', color: '#D8D0E4' },
                  { from: 0.01, to: 0.34, name: '1-33%', color: '#B39BC8' },
                  { from: 0.34, to: 0.68, name: '34-67%', color: '#8B6FAD' },
                  { from: 0.68, to: 1.01, name: '68-100%', color: '#421243' },
                ]}
                valueFormatter={(val) => (val > 0 ? `${Math.round(val * 100)}%` : '')}
                xaxisOverrides={tapAppSearchPositionStatsQuery.data?.[src.key]?.categories ? { categories: tapAppSearchPositionStatsQuery.data[src.key].categories } : {}}
                yaxisReversed
              />
            </div>
          </div>
            </div>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">【搜索页】搜索关键词广告统计({src.label}) — 最近7天</div>
            <DataTable rows={tapAppSearchKeywordRows[src.key] || []} columns={TAPAPP_SEARCH_KEYWORD_COLUMNS} pageSize={10} />
          </div>
            </div>
          </div>
        ))}
        <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">【搜索页】每日广告加载率 — 最近30天</div>
            <div className="card-body">
              <MixedChart
                series={tapAppSearchLoadingRateTrendQuery.data?.series || []}
                loading={tapAppSearchLoadingRateTrendQuery.isLoading}
                error={tapAppSearchLoadingRateTrendQuery.error?.message}
                height={500}
                toolbar={false}
                colors={['#4361ee', '#421243']}
                strokeWidths={[0, 4]}
                dataLabels={{
                  enabled: true,
                  enabledOnSeries: [0],
                  position: 'top',
                  formatter: (val) => formatNumber(val),
                  style: { fontSize: '11px', colors: ['#6c757d'] },
                }}
                tooltipY={(v, yi) => (yi === 1 ? `${(v * 100).toFixed(2)}%` : formatNumber(v))}
                xaxisOverrides={tapAppSearchLoadingRateTrendQuery.data?.categories ? { type: 'category', categories: tapAppSearchLoadingRateTrendQuery.data.categories, labels: { rotate: -45 } } : {}}
                yaxisLeft={{ title: { text: '曝光次数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
                yaxisRight={{ title: { text: '加载率' }, min: 0, max: 0.3, labels: { formatter: (v) => `${(v * 100).toFixed(0)}%` } }}
              />
            </div>
          </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
