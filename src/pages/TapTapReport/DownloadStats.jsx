import { useState, useEffect, useMemo } from 'react';
import BarChart from '../../components/charts/BarChart';
import LineChart from '../../components/charts/LineChart';
import PieChart from '../../components/charts/PieChart';
import { formatNumber, formatCompactNumber } from '../../utils/formatters';
import AppHourTrendTip from './components/AppHourTrendTip';
import { tooltipHtml, tooltipValue } from './components/tooltipHtml';
import ChartCard from './components/ChartCard';
import { nextUpdateTime, formatNextUpdate } from './updateTime';
import { formatNowWindow } from './dates';
import {
  buildAggregateSql,
  buildWeeklyTrendSql,
  buildTodayRealtimeSummarySql,
  buildMonthlyBreakdownSql,
  buildDistributionByWindowSql,
  buildTop25DetailSql,
  buildNewestDateSql,
  HOURLY_TABLE,
} from './sql';
import {
  transformAggregate,
  transformWeeklyTrend,
  transformTodayRealtime,
  transformMonthlyBreakdown,
  transformDistributionByWindow,
  transformTop25Detail,
  transformNewestDate,
} from './transforms';
import { useSqlQuery, useSqlQueryV09 } from './queries';
import DataTable from './components/DataTable';
import { AD_MATERIAL_COLORS, APP_AD_TAG_COLORS, GameIcon, taptapAppUrl } from './shared';
import { GAME_TYPE_LABELS, GAME_TYPE_BADGE_COLORS, PLATFORM_COLORS, PLATFORM_SERIES_COLORS } from './constants';

/** 下载Top25明细窗口类型（只保留小时；日/月统计已按业务要求去掉） */
const WINDOW_TYPES = [
  { label: '小时', table: HOURLY_TABLE, granularity: 'hour' },
];


/** 月趋势拆分图（平台 / 小游戏）配置 */
const MONTHLY_BREAKDOWN_CHARTS = [
  { key: 'platform', title: '热门游戏TopN下载月趋势(平台) — 最近12个月' },
  { key: 'gameType', title: '热门游戏TopN下载月趋势(小游戏) — 最近12个月' },
];

/** 追踪的游戏分布拆分图（平台 / 游戏类型）配置 */
const DISTRIBUTION_CHARTS = [
  { key: 'platform', title: '追踪的游戏分布(平台)' },
  { key: 'gameType', title: '追踪的游戏分布(小游戏)' },
];

/* ===== 图表配色（均取自 AD_MATERIAL_COLORS 色库） ===== */
/** 平台拆分：APP / PC（色值见 constants.PLATFORM_*） */
const PLATFORM_DOWNLOAD_COLORS = PLATFORM_SERIES_COLORS;
const PLATFORM_BADGE_COLORS = PLATFORM_COLORS;
/** 游戏类型标签文案与配色（统一取自 constants.GAME_TYPE_*） */
const DISTRIBUTION_TYPE_LABELS = GAME_TYPE_LABELS;
const DISTRIBUTION_TYPE_BADGE_COLORS = GAME_TYPE_BADGE_COLORS;
/** 游戏类型联动筛选项：null=全部；顺序与饼图扇区一致 */
const TYPE_FILTER_OPTIONS = [
  { value: 1, label: DISTRIBUTION_TYPE_LABELS[1] },
  { value: 2, label: DISTRIBUTION_TYPE_LABELS[2] },
];
/** 平台联动筛选项：null=全部 */
const PLATFORM_FILTER_OPTIONS = [
  { value: 'app', label: 'APP' },
  { value: 'pc', label: 'PC' },
];
/** 饼图「已选中」扇区的描边色（其余扇区留白缝） */
const SELECTED_SLICE_STROKE = '#2F3A44';

/** 饼图扇区标签 → 筛选项值（APP/PC 或 distribution_type） */
function labelToFilterValue(distKey, label) {
  if (distKey === 'platform') {
    if (label.includes('APP')) return 'app';
    if (label.includes('PC')) return 'pc';
    return null;
  }
  const key = Object.keys(DISTRIBUTION_TYPE_LABELS).find((k) => DISTRIBUTION_TYPE_LABELS[k] === label);
  return key == null ? null : Number(key);
}

/** 按选中判定生成每个切片的描边色数组（未选中时全为白缝） */
function buildSliceStrokeColors(labels, isSelected) {
  if (!labels || !labels.length) return null;
  return labels.map((label) => (isSelected(label) ? SELECTED_SLICE_STROKE : '#FFFFFF'));
}
/** 月趋势两个拆分图各自的配色（APP/PC、独立小游戏/Maker小游戏） */
const MONTHLY_BREAKDOWN_COLORS = {
  platform: ['#7A8B99', '#9CAF9F'],
  gameType: ['#8FA3B0', '#9B93A8'],
};
/** 分布饼图扇区：按色库循环 */
const DISTRIBUTION_COLORS = AD_MATERIAL_COLORS;

/** 下载Top25明细拆分表配置 */
const TOP25_DETAIL_TABLES = {
  // 平台版：按饼图选中的 refer 查 Top25（app / pc；全部 = app+pc 全平台）
  platform: { title: '下载Top25明细(平台)', limit: 25, referDriven: true, withPlatform: true, rankWidth: '5%' },
  // 小游戏版：按饼图选中的 distribution_type 查 Top25（1=独立小游戏、2=Maker小游戏；全部则两类都查）
  gameType: { title: '下载Top25明细(小游戏)', limit: 25, typeDriven: true, withType: true, rankWidth: '5%' },
};

/** OneSearch 线索查询路由（站内相对路径，开发/生产都指向当前站点，用 APPID 拼接 q 参数） */
const ONESEARCH_REPORT_PATH = '/one-search/report';

/**
 * 下载Top25明细表格列（游戏名称 / icon / 标签 从全局映射获取）
 * @param {Object} gameMap app_id -> { name, icon, tags }
 * @param {boolean} withOneSearch 是否在「下载数」后追加 OneSearch 跳转列（仅 APP / PC 两张宽表）
 */
/** 取一行的名称/图标/标签：优先用明细行自带（v2 小时表），否则回落到 gameMap（日/月表） */
function rowMeta(r, gameMap) {
  const fromMap = gameMap?.[String(r.appId)];
  return {
    name: r.appName || fromMap?.name || '',
    icon: r.icon || fromMap?.icon || '',
    tags: r.tags?.length ? r.tags : (fromMap?.tags || []),
  };
}

const TOP25_DETAIL_COLUMNS = (
  gameMap,
  { withOneSearch = false, withPlatform = false, withType = false, trend = null } = {}
) => {
  // 列宽分摊（rank 列宽由调用方传入）：带趋势列后重新分配
  const W = withType
    ? { appId: '8%', tags: '20%', extra: '12%', name: '19%', total: '10%', count: '10%', trend: '6%', search: '10%' }
    : withPlatform
      ? { appId: '8%', tags: '21%', extra: '8%', name: '20%', total: '10%', count: '10%', trend: '6%', search: '9%' }
      : withOneSearch
        ? { appId: '12%', tags: '15%', name: '26%', total: '10%', count: '14%', trend: '6%', search: '15%' }
        : { appId: '14%', tags: '20%', name: '32%', total: '10%', count: '18%', trend: '6%' };

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
      accessor: (r) => rowMeta(r, gameMap).tags.join(' '),
      render: (r) => {
        const tags = rowMeta(r, gameMap).tags;
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
    ...(withPlatform
      ? [
          {
            header: '下载平台',
            width: W.extra,
            accessor: (r) => r.refer || '',
            render: (r) => {
              const raw = (r.refer || '').toLowerCase();
              if (!raw || raw === '-') return <span className="text-muted">-</span>;
              const label = raw === 'app+pc' ? 'APP+PC' : raw === 'pc' ? 'PC' : raw === 'app' ? 'APP' : r.refer;
              return (
                <span
                  className="badge"
                  style={{
                    backgroundColor: PLATFORM_BADGE_COLORS[raw] || '#8FA3B0',
                    color: '#fff',
                    fontSize: 10,
                    padding: '2px 6px',
                    fontWeight: 500,
                  }}
                >
                  {label}
                </span>
              );
            },
          },
        ]
      : []),
    ...(withType
      ? [
          {
            header: '游戏类型',
            width: W.extra,
            accessor: (r) => DISTRIBUTION_TYPE_LABELS[r.distributionType] || '',
            render: (r) => {
              const type = r.distributionType;
              const label = DISTRIBUTION_TYPE_LABELS[type];
              if (!label) return <span className="text-muted">-</span>;
              return (
                <span
                  className="badge"
                  style={{
                    backgroundColor: DISTRIBUTION_TYPE_BADGE_COLORS[type] || '#8FA3B0',
                    color: '#fff',
                    fontSize: 10,
                    padding: '2px 6px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </span>
              );
            },
          },
        ]
      : []),
    {
      header: '游戏名称',
      width: W.name,
      accessor: (r) => rowMeta(r, gameMap).name,
      render: (r) => {
        const meta = rowMeta(r, gameMap);
        const name = meta.name || '';
        return (
          <span className="d-inline-flex align-items-center gap-2" title={name || undefined} style={{ minWidth: 0, maxWidth: '100%' }}>
            <GameIcon src={meta.icon} size={20} alt={name ? `${name} 图标` : ''} />
            <span className="fw-semibold" style={{ display: 'inline-block', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
              {name || '-'}
            </span>
          </span>
        );
      },
    },
    {
      header: '历史下载数',
      align: 'end',
      width: W.total,
      accessor: (r) => r.totalDownloadCount,
      render: (r) =>
        r.totalDownloadCount == null ? (
          <span className="text-muted">-</span>
        ) : (
          <span className="text-muted">{formatNumber(r.totalDownloadCount)}</span>
        ),
    },
    { header: '下载数', align: 'end', width: W.count, accessor: (r) => r.downloadCount, render: (r) => <span className="fw-semibold">{formatNumber(r.downloadCount)}</span> },
    ...(trend
      ? [
          {
            header: '趋势',
            align: 'center',
            width: W.trend,
            render: (r) => (
              <AppHourTrendTip
                appId={r.appId}
                appName={rowMeta(r, gameMap).name}
                metric={trend.metric}
                metricLabel={trend.label}
                day={trend.day}
              />
            ),
          },
        ]
      : []),
    ...(withOneSearch
      ? [
          {
            header: 'OneSearch',
            align: 'center',
            width: W.search,
            render: (r) => (
              <a
                href={`${ONESEARCH_REPORT_PATH}?q=${r.appId}`}
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

/** 下载Top25明细查询 hook（小时窗口 + 过滤条件） */
function useTop25DetailQuery(key, table, selectedWindow, enabled, extraOpts = {}) {
  const opts = { ...table, ...extraOpts };
  return useSqlQuery(
    `taptap-top25-${key}`,
    () => buildTop25DetailSql(selectedWindow, opts),
    [selectedWindow, JSON.stringify(extraOpts)],
    transformTop25Detail,
    { enabled, placeholderData: (prev) => prev }
  );
}

/** 周趋势图表配置（平台 / 小游戏） */
const WEEKLY_TREND_CHARTS = {
  platform: {
    key: 'platform',
    title: '热门游戏TopN下载日趋势(平台)',
    colors: PLATFORM_DOWNLOAD_COLORS,
    names: ['APP下载数', 'PC端下载数'],
    // 今日那一点优先用 SQLite 实时数据覆盖（MySQL 日表当天数据不完整）
    realtimeKeys: ['app', 'pc'],
    pairs: (d) => [
      [d?.platform?.current?.app, d?.platform?.previous?.app],
      [d?.platform?.current?.pc, d?.platform?.previous?.pc],
    ],
  },
  miniGame: {
    key: 'miniGame',
    title: '热门游戏TopN下载日趋势(小游戏)',
    colors: ['#8FA3B0', '#9B93A8'],
    names: ['独立小游戏下载数', 'Maker小游戏下载数'],
    // 今日那一点优先用 SQLite 实时数据覆盖（MySQL 日表当天数据不完整）
    realtimeKeys: ['nonMaker', 'maker'],
    pairs: (d) => [
      [d?.miniGame?.current?.nonMaker, d?.miniGame?.previous?.nonMaker],
      [d?.miniGame?.current?.maker, d?.miniGame?.previous?.maker],
    ],
  },
};

/** 口径变更等提示条（浅琥珀底；compact 用于卡片头右上角的紧凑版） */
function ChartNotice({ children, compact = false }) {
  return (
    <div
      className={compact ? 'd-flex gap-2 px-2 py-1 rounded-2' : 'd-flex gap-2 mb-2 px-3 py-2 rounded-3'}
      style={{
        backgroundColor: '#FFF9EC',
        border: '1px solid #F1E3C3',
        maxWidth: compact ? 360 : undefined,
      }}
    >
      <i
        className="bi bi-exclamation-triangle-fill"
        style={{ fontSize: compact ? 11 : 13, lineHeight: compact ? '16px' : '20px', color: '#C08A2E' }}
        aria-hidden="true"
      ></i>
      <div style={{ fontSize: compact ? 11 : 12, lineHeight: compact ? '16px' : '20px', color: '#7A5C22', minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}

/** 热门游戏TopN下载月趋势卡片（带 totalLabels 的堆叠柱，宽 35%） */
function MonthlyBreakdownCard({ chartKey, data, loading, error, updateLabel }) {
  const cfg = MONTHLY_BREAKDOWN_CHARTS.find((c) => c.key === chartKey);
  return (
    <div className="col-12 tt-split-35">
      <ChartCard title={cfg?.title || ''} updateLabel={updateLabel} body>
        <BarChart
            series={data?.[chartKey] || []}
            loading={loading}
            error={error}
            height={350}
            stacked
            colors={MONTHLY_BREAKDOWN_COLORS[chartKey]}
            totalLabels
            shared
            xaxisOverrides={data?.categories ? { categories: data.categories, labels: { rotate: -45 } } : {}}
            yaxisOverrides={{ title: { text: '下载数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
        />
      </ChartCard>
    </div>
  );
}

/** 热门游戏TopN下载日趋势卡片（上周 vs 本周，本周加粗实线、上周虚线，占剩余 65%） */
function WeeklyTrendCard({ chartKey, data, loading, error, updateLabel, notice, realtime }) {
  const cfg = WEEKLY_TREND_CHARTS[chartKey];
  const categories = data?.categories || [];
  // 数据点用 [x=0~6, y] 数值对，缺数据的日期直接不画点（参照【广告大盘】日趋势的做法）。
  // category 轴 + 含 null 的数组会让 Apex 把「折线几何」和「轴标签」算成两套间距，导致整体右偏。
  const toPairs = (arr) => (arr || []).map((v, i) => (v == null ? null : [i, Number(v)])).filter(Boolean);
  const series = [];
  const colorList = [];
  const rt = realtime && realtime.weekdayIdx != null ? realtime : null;
  cfg.pairs(data).forEach(([cur, prev], i) => {
    // 今天这一点的本周值用 SQLite 实时汇总覆盖（MySQL 日表当天数据不完整）
    let current = cur;
    const rtKey = cfg.realtimeKeys?.[i];
    if (rt && rtKey && rt[rtKey] != null) {
      current = (cur || []).slice();
      current[rt.weekdayIdx] = rt[rtKey];
    }
    series.push({ name: `${cfg.names[i]}（本周）`, data: toPairs(current) });
    series.push({ name: `${cfg.names[i]}（上周）`, data: toPairs(prev) });
    colorList.push(cfg.colors[i], cfg.colors[i]);
  });

  // 自定义 tooltip：同一个 x（周几）下把所有系列的值都列出来。
  // Apex 默认在鼠标压到某个点/某条线上时只显示当前系列，这里统一成整列读数。
  const tooltipCustom = ({ series: rawSeries, dataPointIndex }) => {
    const valueAt = (arr, idx) => {
      const p = arr?.[idx];
      if (Array.isArray(p)) return p[1];
      if (p && typeof p === 'object') return p.y;
      return p;
    };
    const firstPoint = rawSeries?.[0]?.[dataPointIndex];
    const xValue = Array.isArray(firstPoint) ? firstPoint[0] : dataPointIndex;
    const xLabel = categories[Math.round(xValue)] ?? '';
    return tooltipHtml({
      title: xLabel,
      minWidth: 210,
      rows: series.map((s, i) => ({
        name: s.name,
        color: colorList[i],
        value: tooltipValue(valueAt(rawSeries?.[i], dataPointIndex), formatNumber),
      })),
    });
  };

  const realtimeNote = rt
    ? `今日（${categories[rt.weekdayIdx] || '今天'}）为实时数据，截至 ${String(rt.latestHour).slice(11)}:00`
    : null;

  return (
    <div className="col-12 tt-split-65">
      <ChartCard
        title={cfg.title}
        subtitle={realtimeNote}
        updateLabel={updateLabel}
        notice={notice ? <ChartNotice compact>{notice}</ChartNotice> : null}
        body
      >
          <LineChart
            series={series}
            loading={loading}
            error={error}
            height={350}
            toolbar={false}
            strokeWidth={[3, 1.8, 3, 1.8]}
            strokeDashArray={[0, 5, 0, 5]}
            colors={colorList}
            // 与【广告大盘】日趋势一致：markers size 6 → 常态直径 12px，hover 12 → 悬停直径 24px
            markers={{ size: 6, hover: { size: 12 } }}
            tooltipCustom={tooltipCustom}
            shared
            legendOverrides={{ fontSize: '9px' }}
            // 数值轴：0~6 对应周一到周日，点和标签共用同一套坐标，不会错位
            xaxisOverrides={{
              type: 'numeric',
              min: 0,
              max: 6,
              tickAmount: 6,
              labels: { rotate: 0, formatter: (v) => categories[Math.round(v)] ?? '' },
            }}
            yaxisOverrides={{ title: { text: '下载数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
          />
      </ChartCard>
    </div>
  );
}

export default function DownloadStats() {
  const [selectedTable, setSelectedTable] = useState(HOURLY_TABLE);
  const [selectedWindow, setSelectedWindow] = useState(() => formatNowWindow('hour'));
  // 饼图 ↔ 明细表联动：两张饼图默认都选「全部」（平台 = APP+PC，小游戏 = distribution_type 1+2）
  const [platformFilter, setPlatformFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);

  // 提示性文案，仅在渲染时计算一次（不轮询、不额外请求）
  const nowRef = new Date();
  // 热门游戏TopN下载趋势：cron 分钟=5，每 2 小时一次
  const nextUpdateLabelMin5 = `下次更新时间 ${formatNextUpdate(nextUpdateTime(5, nowRef))}`;
  // 月趋势三图：cron 分钟=7，每 2 小时一次
  const nextUpdateLabelMin7 = `下次更新时间 ${formatNextUpdate(nextUpdateTime(7, nowRef))}`;
  // 热门游戏TopN下载日趋势（周对比）：cron 分钟=6，每 2 小时一次
  const nextUpdateLabelMin6 = `下次更新时间 ${formatNextUpdate(nextUpdateTime(6, nowRef))}`;
  // 下载Top25明细查询条件（小时/日/月）→ 关联图表使用的更新频率：5 / 6 / 7 分钟
  const windowGranularity = WINDOW_TYPES.find((w) => w.table === selectedTable)?.granularity || 'hour';
  const windowUpdateLabel =
    windowGranularity === 'day' ? nextUpdateLabelMin6 : windowGranularity === 'month' ? nextUpdateLabelMin7 : nextUpdateLabelMin5;

  const hotListQuery = useSqlQuery('taptap-hot-list-trend', buildAggregateSql, [], transformAggregate, { enabled: true });
  // 周趋势走 MySQL（v09 接口）的 dws_taptap_download_v2_daily（历史数据）
  const weeklyTrendQuery = useSqlQueryV09('taptap-weekly-trend', buildWeeklyTrendSql, [], transformWeeklyTrend, { enabled: true });
  // 今日实时：SQLite 的 dws_taptap_download_summary_hourly 聚合当天，覆盖「今天」那一点
  const todayRealtimeQuery = useSqlQuery('taptap-today-realtime', buildTodayRealtimeSummarySql, [], transformTodayRealtime, {
    enabled: true,
    staleTime: 60 * 1000,
  });
  // 月趋势走 MySQL（v09 接口）的 dws_taptap_download_v2_monthly
  const monthlyBreakdownQuery = useSqlQueryV09('taptap-monthly-breakdown', buildMonthlyBreakdownSql, [], transformMonthlyBreakdown, { enabled: true });
  const distributionByWindowQuery = useSqlQuery('taptap-distribution-by-window', () => buildDistributionByWindowSql(selectedWindow), [selectedWindow], transformDistributionByWindow, { enabled: true });
  const newestDateQuery = useSqlQuery('taptap-newest-date', buildNewestDateSql, [], transformNewestDate);

  const top25DetailQueries = {
    platform: useTop25DetailQuery('platform', TOP25_DETAIL_TABLES.platform, selectedWindow, true, {
      // 全部 = APP+PC 全平台
      referFilter: platformFilter == null ? 'all' : platformFilter,
    }),
    gameType: useTop25DetailQuery('gameType', TOP25_DETAIL_TABLES.gameType, selectedWindow, true, {
      // 全部 = 全部小游戏（distribution_type IN (1,2)），不是「所有游戏类型」
      typeFilter: typeFilter == null ? 'all' : typeFilter,
    }),
  };

  // 明细按饼图选中项过滤（Top50 已在 SQL 里各取，这里只做客户端筛选）
  // 平台明细由 SQL 按饼图选中平台取 Top25，这里不再做客户端筛选
  const platformRows = top25DetailQueries.platform.data?.rows || [];

  // 小游戏表明细由 SQL 按饼图选中类型取 Top25，这里不再做客户端筛选
  const gameTypeRows = top25DetailQueries.gameType.data?.rows || [];

  // 选中扇区加深色描边（其余留白缝），首屏就能看出默认选中了哪一项
  const platformLabels = distributionByWindowQuery.data?.platform?.labels || [];
  const gameTypeLabels = distributionByWindowQuery.data?.gameType?.labels || [];
  const platformStrokeColors = useMemo(
    () =>
      buildSliceStrokeColors(platformLabels, (label) => {
        if (platformFilter == null) return false;
        return platformFilter === (label.includes('APP') ? 'app' : 'pc');
      }),
    [platformLabels.join('|'), platformFilter] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const gameTypeStrokeColors = useMemo(
    () =>
      buildSliceStrokeColors(
        gameTypeLabels,
        (label) => typeFilter != null && DISTRIBUTION_TYPE_LABELS[typeFilter] === label
      ),
    [gameTypeLabels.join('|'), typeFilter] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // 两张饼图各自的联动配置
  const distFilters = {
    platform: { selected: platformFilter, setSelected: setPlatformFilter, options: PLATFORM_FILTER_OPTIONS, strokeColors: platformStrokeColors },
    gameType: { selected: typeFilter, setSelected: setTypeFilter, options: TYPE_FILTER_OPTIONS, strokeColors: gameTypeStrokeColors },
  };

  // 数据最新时间加载后，小时选项的统计窗口默认值同步到最新数据时间，避免数据更新期间空白
  useEffect(() => {
    if (selectedTable === HOURLY_TABLE && newestDateQuery.data) {
      setSelectedWindow(newestDateQuery.data);
    }
  }, [newestDateQuery.data, selectedTable]);

  // 近 24 小时堆叠柱 tooltip：列出三个游戏类型以及合计
  const deltaTooltip = ({ series, dataPointIndex }) => {
    const rows = (series || []).map((arr) => Number(arr?.[dataPointIndex] ?? 0));
    const total = rows.reduce((a, b) => a + (Number.isNaN(b) ? 0 : b), 0);
    return tooltipHtml({
      title: hotListQuery.data?.categories?.[dataPointIndex] ?? '',
      minWidth: 200,
      rows: (hotListQuery.data?.series || []).map((sr, i) => ({
        name: sr.name,
        color: sr.color,
        value: tooltipValue(rows[i], formatNumber),
      })),
      total: { name: '合计', color: '#A7B0B8', value: formatNumber(total) },
    });
  };

  return (
    <>
      {/* 热门游戏TopN下载趋势（聚合） */}
      <div className="mb-4">
        <ChartCard title="追踪游戏下载趋势(游戏类型) — 近24小时（增量）" updateLabel={nextUpdateLabelMin5} body>
          <BarChart
            series={hotListQuery.data?.series || []}
            loading={hotListQuery.isLoading}
            error={hotListQuery.error?.message}
            height={675}
            stacked
            totalLabels
            columnWidth="45%"
            colors={['#8FA3B0', '#B08B8B', '#9B93A8']}
            tooltipCustom={deltaTooltip}
            xaxisOverrides={
              hotListQuery.data?.categories
                ? { type: 'category', categories: hotListQuery.data.categories, labels: { rotate: -45 } }
                : {}
            }
            yaxisOverrides={{
              title: { text: '增量下载数' },
              labels: { formatter: (v) => formatCompactNumber(v) },
            }}
        />
        </ChartCard>
      </div>

      {/* 月趋势 / 日趋势：平台一组、小游戏一组 */}
      <div className="row g-3 mb-4">
        <MonthlyBreakdownCard
          chartKey="platform"
          data={monthlyBreakdownQuery.data}
          loading={monthlyBreakdownQuery.isLoading}
          error={monthlyBreakdownQuery.error?.message}
          updateLabel={nextUpdateLabelMin7}
        />
        <WeeklyTrendCard
          chartKey="platform"
          data={weeklyTrendQuery.data}
          loading={weeklyTrendQuery.isLoading}
          error={weeklyTrendQuery.error?.message}
          updateLabel={nextUpdateLabelMin6}
          realtime={todayRealtimeQuery.data}
        />
      </div>

      <div className="row g-3 mb-4">
        <MonthlyBreakdownCard
          chartKey="gameType"
          data={monthlyBreakdownQuery.data}
          loading={monthlyBreakdownQuery.isLoading}
          error={monthlyBreakdownQuery.error?.message}
          updateLabel={nextUpdateLabelMin7}
        />
        <WeeklyTrendCard
          chartKey="miniGame"
          data={weeklyTrendQuery.data}
          loading={weeklyTrendQuery.isLoading}
          error={weeklyTrendQuery.error?.message}
          updateLabel={nextUpdateLabelMin6}
          realtime={todayRealtimeQuery.data}
          notice="11 月 3 日 - 11 月 7 日数据口径调整，所显示数据没有参考意义"
        />
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
            {/* 只读：窗口值跟随最新数据时间自动同步，避免手输与数据不一致 */}
            <input
              type="text"
              className="form-control form-control-sm"
              style={{ width: 180, backgroundColor: '#F7F9FA', cursor: 'default' }}
              value={selectedWindow}
              readOnly
              aria-readonly="true"
              title="统计窗口跟随数据最新时间自动同步"
            />
          </div>
        </div>
      </div>

      {/* 追踪的游戏分布（平台/AI 并排） */}
      {/* 分布饼图 + Top25 明细：两两一行，顺序为 平台｜平台明细、小游戏｜小游戏明细 */}
      {[
        ['platform', 'platform'],
        ['gameType', 'gameType'],
      ].map(([distKey, tableKey]) => {
        const dist = DISTRIBUTION_CHARTS.find((c) => c.key === distKey);
        const filter = distFilters[distKey];
        return (
          <div className="row g-3 mb-4" key={`${distKey}-${tableKey}`}>
            {/* 追踪的游戏分布（宽 35%） */}
            <div className="col-12 tt-split-35">
              <ChartCard
                title={dist?.title || ''}
                updateLabel={windowUpdateLabel}
                body
                bodyClassName="d-flex flex-column align-items-center justify-content-center"
                actions={
                  <div className="d-flex align-items-center gap-1 flex-wrap">
                    <span className="text-muted" style={{ fontSize: 11 }}>明细筛选</span>
                    <button
                      type="button"
                      className={`btn btn-sm ${filter.selected == null ? 'btn-primary' : 'btn-outline-secondary'}`}
                      style={{ fontSize: 11, padding: '1px 8px' }}
                      onClick={() => filter.setSelected(null)}
                    >
                      全部
                    </button>
                    {filter.options.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`btn btn-sm ${filter.selected === opt.value ? 'btn-primary' : 'btn-outline-secondary'}`}
                        style={{ fontSize: 11, padding: '1px 8px' }}
                        onClick={() => filter.setSelected(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                }
              >
                  <PieChart
                    series={distributionByWindowQuery.data?.[distKey]?.series || []}
                    labels={distributionByWindowQuery.data?.[distKey]?.labels || []}
                    loading={distributionByWindowQuery.isLoading}
                    error={distributionByWindowQuery.error?.message}
                    height={300}
                    donut
                    // 小游戏的扇区名较长，标签只显示百分比，名称交给图例，避免压住圆心「小游戏数」
                    percentOnly={distKey === 'gameType'}
                    colors={DISTRIBUTION_COLORS}
                    sliceStrokeColors={filter.strokeColors}
                    sliceStrokeWidth={filter.selected != null ? 2.5 : 1}
                    legendOverrides={{ horizontalAlign: 'center' }}
                    totalLabel={distributionByWindowQuery.data?.[distKey]?.totalLabel}
                    totalValue={distributionByWindowQuery.data?.[distKey]?.totalValue}
                    onDataClick={({ label }) => {
                      const value = labelToFilterValue(distKey, label);
                      if (value == null) return;
                      // 再点一次已选中的扇区即取消筛选（回到全部）
                      filter.setSelected((prev) => (prev === value ? null : value));
                    }}
              />
              </ChartCard>
            </div>

            {/* 下载TopN明细（占剩余 65%） */}
            <div className="col-12 tt-split-65">
              <ChartCard title={TOP25_DETAIL_TABLES[tableKey].title} updateLabel={windowUpdateLabel}>
                <DataTable
                  rows={tableKey === 'gameType' ? gameTypeRows : platformRows}
                  columns={TOP25_DETAIL_COLUMNS(null, {
                    withOneSearch: true,
                    withPlatform: !!TOP25_DETAIL_TABLES[tableKey].withPlatform,
                    withType: !!TOP25_DETAIL_TABLES[tableKey].withType,
                    // 趋势图取值口径与当前明细口径一致
                    trend: {
                      metric:
                        tableKey === 'platform'
                          ? platformFilter === 'pc'
                            ? 'pc_download_count'
                            : platformFilter === 'app'
                              ? 'app_download_count'
                              : 'download_count'
                          : 'download_count',
                      label:
                        tableKey === 'platform'
                          ? platformFilter === 'pc'
                            ? 'PC下载数'
                            : platformFilter === 'app'
                              ? 'APP下载数'
                              : '总下载数'
                          : '小游戏下载数',
                      day: String(selectedWindow || '').slice(0, 10),
                    },
                  })}
                  tableClassName="top25-table"
                  fixedLayout
                  rankColWidth={TOP25_DETAIL_TABLES[tableKey].rankWidth || '6%'}
                />
              </ChartCard>
            </div>
          </div>
        );
      })}

    </>
  );
}
