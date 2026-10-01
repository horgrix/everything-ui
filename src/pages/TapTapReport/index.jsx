import { useState, useEffect } from 'react';
import BarChart from '../../components/charts/BarChart';
import LineChart from '../../components/charts/LineChart';
import MixedChart from '../../components/charts/MixedChart';
import PieChart from '../../components/charts/PieChart';
import TreemapChart from '../../components/charts/TreemapChart';
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
} from './transforms';
import { useSqlQuery } from './queries';
import DataTable from './components/DataTable';
import KpiRow from './components/KpiRow';

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
  { header: 'AppID', render: (r) => <span className="text-muted small">{r.appId}</span> },
  { header: '游戏名称', render: (r) => <span className="fw-semibold">{gameNameMap?.[String(r.appId)] || '-'}</span> },
  { header: '下载数', align: 'end', render: (r) => <span className="fw-semibold">{formatNumber(r.downloadCount)}</span> },
  { header: '时间', render: (r) => <span className="text-muted small">{r.crawledAt}</span> },
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
      {/* TapPC热玩游戏榜在线人数趋势（全宽） */}
      <div className="row g-3 mb-4">
        <div className="col-12">
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
                height={350}
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
      </div>

      {/* 游戏数占比 + TopN游戏占比（并排，30% / 70%） */}
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
                height={450}
                donut
                totalLabel="总游戏数"
                toolbar={false}
                dataLabelsOffset={45}
                minAngleToShowLabel={0}
              />
            </div>
          </div>
        </div>
        {/* TopN游戏占比（右，70%） */}
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
                height={450}
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

      {/* TapPC游戏在线人数分布图 */}
      <div className="card border-0 shadow-sm mb-4">
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
            height={750}
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
        <div className="text-center text-muted py-5">
          <i className="bi bi-inbox fs-1 d-block mb-2"></i>
          暂无数据
        </div>
      )}
    </div>
  );
}
