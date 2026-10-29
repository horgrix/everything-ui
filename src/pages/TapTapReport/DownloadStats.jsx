import { useState, useEffect } from 'react';
import BarChart from '../../components/charts/BarChart';
import LineChart from '../../components/charts/LineChart';
import PieChart from '../../components/charts/PieChart';
import { formatNumber, formatCompactNumber } from '../../utils/formatters';
import UpdateTag from './UpdateTag';
import { nextUpdateTime, formatNextUpdate } from './updateTime';
import {
  buildAggregateSql,
  buildDetailSql,
  buildSummarySql,
  buildDailyTrendSql,
  buildMonthlyBreakdownSql,
  buildDistributionByWindowSql,
  buildTop25DetailSql,
  buildGameNameSql,
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
  transformNewestDate,
} from './transforms';
import { useSqlQuery } from './queries';
import DataTable from './components/DataTable';
import KpiRow from './components/KpiRow';
import { AD_MATERIAL_COLORS, APP_AD_TAG_COLORS, GameIcon, taptapAppUrl } from './shared';

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

/* ===== 图表配色（均取自 AD_MATERIAL_COLORS 色库） ===== */
/** 平台拆分：APP / PC */
const PLATFORM_DOWNLOAD_COLORS = ['#7A8B99', '#9CAF9F'];
/** 月趋势三个拆分图各自的配色（APP/PC、非AI/AI、非TapMaker/TapMaker） */
const MONTHLY_BREAKDOWN_COLORS = {
  platform: ['#7A8B99', '#9CAF9F'],
  ai: ['#8FA3B0', '#C9B79C'],
  tapmaker: ['#9B93A8', '#B08B8B'],
};
/** 日趋势 7 条折线：按色库循环 */
const DAILY_TREND_COLORS = AD_MATERIAL_COLORS;
/** 分布饼图扇区：按色库循环 */
const DISTRIBUTION_COLORS = AD_MATERIAL_COLORS;
/** 游戏详情趋势：PC / 移动 / 总下载数 */
const DETAIL_TREND_COLORS = ['#7A8B99', '#9CAF9F', '#C4A4A4'];

/** 下载Top25明细拆分表配置 */
const TOP25_DETAIL_TABLES = {
  app: { title: '下载Top25明细(APP)', hourFilter: "refer = 'app'", dayFilter: 'app_download_count > 0', orderBy: 'app_download_count' },
  pc: { title: '下载Top25明细(PC)', hourFilter: "refer = 'pc'", dayFilter: 'pc_download_count > 0', orderBy: 'pc_download_count' },
  ai: { title: '下载Top25明细(AI)', hourFilter: 'distribution_type > 0', dayFilter: 'ai_download_count > 0', orderBy: 'ai_download_count' },
  noneMaker: { title: '下载Top25明细(非TapMaker)', hourFilter: 'distribution_type = 1', dayFilter: 'ai_none_maker_download_count > 0', orderBy: 'ai_none_maker_download_count' },
  maker: { title: '下载Top25明细(TapMaker)', hourFilter: 'distribution_type = 2', dayFilter: 'ai_maker_download_count > 0', orderBy: 'ai_maker_download_count' },
};

/** OneSearch 线索查询地址（用 APPID 拼接） */
const ONESEARCH_REPORT_URL = 'https://data.horgrix.com/one-search/report';

/**
 * 下载Top25明细表格列（游戏名称 / icon / 标签 从全局映射获取）
 * @param {Object} gameMap app_id -> { name, icon, tags }
 * @param {boolean} withOneSearch 是否在「下载数」后追加 OneSearch 跳转列（仅 APP / PC 两张宽表）
 */
const TOP25_DETAIL_COLUMNS = (gameMap, withOneSearch = false) => {
  // 多一列时分摊宽度：6(#) / 13 / 18 / 30 / 16 / 17（OneSearch 表头较宽，需 17%）
  const W = withOneSearch
    ? { appId: '13%', tags: '18%', name: '30%', count: '16%', search: '17%' }
    : { appId: '15%', tags: '23%', name: '36%', count: '20%' };

  return [
    {
      header: 'AppID',
      width: W.appId,
      accessor: (r) => r.appId,
      render: (r) => (
        <a
          href={taptapAppUrl(r.appId)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-decoration-none small"
          style={{ color: '#4361ee', whiteSpace: 'nowrap' }}
          title={`在 TapTap 打开（APPID ${r.appId}）`}
        >
          {r.appId}
        </a>
      ),
    },
    {
      header: '标签',
      width: W.tags,
      accessor: (r) => (gameMap?.[String(r.appId)]?.tags || []).join(' '),
      render: (r) => {
        const tags = gameMap?.[String(r.appId)]?.tags || [];
        if (!tags.length) return <span className="text-muted">-</span>;
        return (
          <div className="d-flex flex-wrap gap-1">
            {tags.map((tag, i) => (
              <span
                key={`${tag}-${i}`}
                className="badge"
                style={{ backgroundColor: APP_AD_TAG_COLORS[`tag${i + 1}`], color: '#fff', fontSize: 10, padding: '2px 5px', fontWeight: 500 }}
              >
                {tag}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      header: '游戏名称',
      width: W.name,
      accessor: (r) => gameMap?.[String(r.appId)]?.name || '',
      render: (r) => {
        const meta = gameMap?.[String(r.appId)];
        const name = meta?.name || '';
        return (
          <span className="d-inline-flex align-items-center gap-2" title={name || undefined} style={{ minWidth: 0, maxWidth: '100%' }}>
            <GameIcon src={meta?.icon} size={20} alt={name ? `${name} 图标` : ''} />
            <span className="fw-semibold" style={{ display: 'inline-block', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
              {name || '-'}
            </span>
          </span>
        );
      },
    },
    { header: '下载数', align: 'end', width: W.count, accessor: (r) => r.downloadCount, render: (r) => <span className="fw-semibold">{formatNumber(r.downloadCount)}</span> },
    ...(withOneSearch
      ? [
          {
            header: 'OneSearch',
            align: 'center',
            width: W.search,
            render: (r) => (
              <a
                href={`${ONESEARCH_REPORT_URL}?q=${r.appId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-decoration-none d-inline-flex align-items-center gap-1"
                style={{ color: '#4361ee', fontSize: 12, whiteSpace: 'nowrap' }}
                title={`在 OneSearch 查询 ${r.appId} 的下载 / 在线 / 投放数据`}
              >
                <i className="bi bi-search" aria-hidden="true"></i>
                Search
              </a>
            ),
          },
        ]
      : []),
  ];
};

/** 下载Top25明细查询 hook（按窗口 + 过滤条件） */
function useTop25DetailQuery(key, table, selectedTable, selectedWindow, enabled) {
  return useSqlQuery(
    `taptap-top25-${key}`,
    () => buildTop25DetailSql(selectedTable, selectedWindow, table.hourFilter, table.dayFilter, table.orderBy),
    [selectedTable, selectedWindow],
    transformTop25Detail,
    { enabled }
  );
}

export default function DownloadStats() {
  const [appId, setAppId] = useState('');
  const [days, setDays] = useState(1);
  const [selectedTable, setSelectedTable] = useState('dws_taptap_download_hourly');
  const [selectedWindow, setSelectedWindow] = useState(() => formatNowWindow('hour'));
  const validAppId = /^\d+$/.test(appId);

  // 提示性文案，仅在渲染时计算一次（不轮询、不额外请求）
  const nowRef = new Date();
  // 热门游戏TopN下载趋势：cron 分钟=5，每 2 小时一次
  const nextUpdateLabelMin5 = `下次更新时间 ${formatNextUpdate(nextUpdateTime(5, nowRef))}`;
  // 月趋势三图：cron 分钟=7，每 2 小时一次
  const nextUpdateLabelMin7 = `下次更新时间 ${formatNextUpdate(nextUpdateTime(7, nowRef))}`;
  // 热门游戏TopN下载日趋势：cron 分钟=6，每 2 小时一次
  const nextUpdateLabelMin6 = `下次更新时间 ${formatNextUpdate(nextUpdateTime(6, nowRef))}`;
  // 下载Top25明细查询条件（小时/日/月）→ 关联图表使用的更新频率：5 / 6 / 7 分钟
  const windowGranularity = WINDOW_TYPES.find((w) => w.table === selectedTable)?.granularity || 'hour';
  const windowUpdateLabel =
    windowGranularity === 'day' ? nextUpdateLabelMin6 : windowGranularity === 'month' ? nextUpdateLabelMin7 : nextUpdateLabelMin5;

  const hotListQuery = useSqlQuery('taptap-hot-list-trend', buildAggregateSql, [], transformAggregate, { enabled: true });
  const detailQuery = useSqlQuery('taptap-game-detail', () => buildDetailSql(appId, days), [appId, days], transformDetail, { enabled: validAppId });
  const summaryQuery = useSqlQuery('taptap-game-summary', () => buildSummarySql(appId, days), [appId, days], transformKpiSnapshot, { enabled: validAppId });
  const dailyTrendQuery = useSqlQuery('taptap-daily-trend', buildDailyTrendSql, [], transformDailyTrend, { enabled: true });
  const monthlyBreakdownQuery = useSqlQuery('taptap-monthly-breakdown', buildMonthlyBreakdownSql, [], transformMonthlyBreakdown, { enabled: true });
  const distributionByWindowQuery = useSqlQuery('taptap-distribution-by-window', () => buildDistributionByWindowSql(selectedTable, selectedWindow), [selectedTable, selectedWindow], transformDistributionByWindow, { enabled: true });
  const gameNameQuery = useSqlQuery('taptap-game-name-map', buildGameNameSql, [], transformGameNameMap, { enabled: true });
  const newestDateQuery = useSqlQuery('taptap-newest-date', buildNewestDateSql, [], transformNewestDate);

  const top25DetailQueries = {
    app: useTop25DetailQuery('app', TOP25_DETAIL_TABLES.app, selectedTable, selectedWindow, true),
    pc: useTop25DetailQuery('pc', TOP25_DETAIL_TABLES.pc, selectedTable, selectedWindow, true),
    ai: useTop25DetailQuery('ai', TOP25_DETAIL_TABLES.ai, selectedTable, selectedWindow, true),
    noneMaker: useTop25DetailQuery('noneMaker', TOP25_DETAIL_TABLES.noneMaker, selectedTable, selectedWindow, true),
    maker: useTop25DetailQuery('maker', TOP25_DETAIL_TABLES.maker, selectedTable, selectedWindow, true),
  };

  // 数据最新时间加载后，小时选项的统计窗口默认值同步为最新数据时间，避免数据更新期间空白
  useEffect(() => {
    if (selectedTable === 'dws_taptap_download_hourly' && newestDateQuery.data) {
      setSelectedWindow(newestDateQuery.data);
    }
  }, [newestDateQuery.data, selectedTable]);

  const detailEmpty = !validAppId || (detailQuery.isSuccess && !detailQuery.data?.series?.length);

  return (
    <>
      {/* 热门游戏TopN下载趋势（聚合） */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-0">
          <div className="fw-semibold">热门游戏TopN下载趋势 — 近24小时（增量）</div>
          <div className="mt-1">
            <UpdateTag text={nextUpdateLabelMin5} />
          </div>
        </div>
        <div className="card-body">
          <BarChart
            series={hotListQuery.data?.series || []}
            loading={hotListQuery.isLoading}
            error={hotListQuery.error?.message}
            height={675}
            stacked
            colors={PLATFORM_DOWNLOAD_COLORS}
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
              <div className="card-header bg-white border-0">
                <div className="fw-semibold">{c.title}</div>
                <div className="mt-1">
                  <UpdateTag text={nextUpdateLabelMin7} />
                </div>
              </div>
              <div className="card-body">
                <BarChart
                  series={monthlyBreakdownQuery.data?.[c.key] || []}
                  loading={monthlyBreakdownQuery.isLoading}
                  error={monthlyBreakdownQuery.error?.message}
                  height={350}
                  stacked
                  colors={MONTHLY_BREAKDOWN_COLORS[c.key]}
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
        <div className="card-header bg-white border-0">
          <div className="fw-semibold">热门游戏TopN下载日趋势 — 最近30天</div>
          <div className="mt-1">
            <UpdateTag text={nextUpdateLabelMin6} />
          </div>
        </div>
        <div className="card-body">
          <LineChart
            series={dailyTrendQuery.data?.series || []}
            loading={dailyTrendQuery.isLoading}
            error={dailyTrendQuery.error?.message}
            height={350}
            strokeWidth={2}
            colors={DAILY_TREND_COLORS}
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
              <div className="card-header bg-white border-0">
                <div className="fw-semibold">{c.title}</div>
                <div className="mt-1">
                  <UpdateTag text={windowUpdateLabel} />
                </div>
              </div>
              <div className="card-body d-flex flex-column align-items-center justify-content-center">
                <PieChart
                  series={distributionByWindowQuery.data?.[c.key]?.series || []}
                  labels={distributionByWindowQuery.data?.[c.key]?.labels || []}
                  loading={distributionByWindowQuery.isLoading}
                  error={distributionByWindowQuery.error?.message}
                  height={300}
                  donut
                  colors={DISTRIBUTION_COLORS}
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
              <div className="card-header bg-white border-0">
                <div className="fw-semibold">{TOP25_DETAIL_TABLES[key].title}</div>
                <div className="mt-1">
                  <UpdateTag text={windowUpdateLabel} />
                </div>
              </div>
              <DataTable
                rows={top25DetailQueries[key].data?.rows || []}
                columns={TOP25_DETAIL_COLUMNS(gameNameQuery.data, true)}
                tableClassName="top25-table"
                fixedLayout
                rankColWidth="6%"
              />
            </div>
          </div>
        ))}
      </div>

      {/* 下载Top25明细（AI/非TapMaker/TapMaker） */}
      <div className="row g-3 mb-4">
        {['ai', 'noneMaker', 'maker'].map((key) => (
          <div className="col-12 col-md-4" key={key}>
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0">
                <div className="fw-semibold">{TOP25_DETAIL_TABLES[key].title}</div>
                <div className="mt-1">
                  <UpdateTag text={windowUpdateLabel} />
                </div>
              </div>
              <DataTable rows={top25DetailQueries[key].data?.rows || []} columns={TOP25_DETAIL_COLUMNS(gameNameQuery.data)} tableClassName="top25-table" fixedLayout rankColWidth="6%" />
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
              colors={DETAIL_TREND_COLORS}
              strokeDashArray={[5, 5, 0]}
              shared
              xaxisOverrides={detailQuery.data?.categories ? { type: 'category', categories: detailQuery.data.categories, labels: { rotate: -45 } } : {}}
              yaxisOverrides={{ title: { text: '下载数' }, labels: { formatter: (v) => formatCompactNumber(v) } }} />
          )}
        </div>
      </div>
    </>
  );
}
