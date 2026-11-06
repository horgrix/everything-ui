import { useState, useEffect, useMemo } from 'react';
import BarChart from '../../components/charts/BarChart';
import LineChart from '../../components/charts/LineChart';
import PieChart from '../../components/charts/PieChart';
import { formatNumber, formatCompactNumber } from '../../utils/formatters';
import UpdateTag from './UpdateTag';
import { nextUpdateTime, formatNextUpdate } from './updateTime';
import {
  buildAggregateSql,
  buildWeeklyTrendSql,
  buildMonthlyBreakdownSql,
  buildDistributionByWindowSql,
  buildTop25DetailSql,
  buildGameNameSql,
  buildNewestDateSql,
} from './sql';
import {
  transformAggregate,
  transformWeeklyTrend,
  transformMonthlyBreakdown,
  transformDistributionByWindow,
  transformTop25Detail,
  transformGameNameMap,
  transformNewestDate,
} from './transforms';
import { useSqlQuery } from './queries';
import DataTable from './components/DataTable';
import { AD_MATERIAL_COLORS, APP_AD_TAG_COLORS, GameIcon, taptapAppUrl } from './shared';

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
/** 平台拆分：APP / PC */
const PLATFORM_DOWNLOAD_COLORS = ['#7A8B99', '#9CAF9F'];
/** 「下载平台」标签配色：APP / PC / APP+PC 各自区分（取自同一色库） */
const PLATFORM_BADGE_COLORS = { app: '#7A8B99', pc: '#9CAF9F', 'app+pc': '#B08B8B' };
/** 游戏类型标签文案与配色（1=非Maker独立小游戏、2=Maker独立小游戏；0=商业游戏保留文案兜底） */
const DISTRIBUTION_TYPE_LABELS = { 0: '商业游戏', 1: '非Maker独立小游戏', 2: 'Maker独立小游戏' };
const DISTRIBUTION_TYPE_BADGE_COLORS = { 0: '#8FA3B0', 1: '#C9B79C', 2: '#9B93A8' };
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
/** 月趋势两个拆分图各自的配色（APP/PC、非Maker/Maker独立小游戏） */
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
  // 小游戏版：按饼图选中的 distribution_type 查 Top25（1=非Maker独立小游戏、2=Maker独立小游戏；全部则两类都查）
  gameType: { title: '下载Top25明细(小游戏)', limit: 25, typeDriven: true, withType: true, rankWidth: '5%' },
};

/** OneSearch 线索查询路由（站内相对路径，开发/生产都指向当前站点，用 APPID 拼接 q 参数） */
const ONESEARCH_REPORT_PATH = '/one-search/report';

/**
 * 下载Top25明细表格列（游戏名称 / icon / 标签 从全局映射获取）
 * @param {Object} gameMap app_id -> { name, icon, tags }
 * @param {boolean} withOneSearch 是否在「下载数」后追加 OneSearch 跳转列（仅 APP / PC 两张宽表）
 */
const TOP25_DETAIL_COLUMNS = (gameMap, { withOneSearch = false, withPlatform = false, withType = false } = {}) => {
  // 列宽分摊（rank 列宽由调用方传入）：平台表 5/10/30/10/25/10/10；小游戏表标签更长，让出 3%
  const W = withType
    ? { appId: '10%', tags: '25%', extra: '15%', name: '25%', count: '10%', search: '10%' }
    : withPlatform
      ? { appId: '10%', tags: '30%', extra: '10%', name: '25%', count: '10%', search: '10%' }
      : withOneSearch
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

/** 下载Top25明细查询 hook（按窗口 + 过滤条件） */
function useTop25DetailQuery(key, table, selectedTable, selectedWindow, enabled, extraOpts = {}) {
  const opts = { ...table, ...extraOpts };
  return useSqlQuery(
    `taptap-top25-${key}`,
    () => buildTop25DetailSql(selectedTable, selectedWindow, opts),
    [selectedTable, selectedWindow, JSON.stringify(extraOpts)],
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
    pairs: (d) => [
      [d?.platform?.current?.app, d?.platform?.previous?.app],
      [d?.platform?.current?.pc, d?.platform?.previous?.pc],
    ],
  },
  miniGame: {
    key: 'miniGame',
    title: '热门游戏TopN下载日趋势(小游戏)',
    colors: ['#8FA3B0', '#9B93A8'],
    names: ['非Maker独立小游戏下载数', 'Maker独立小游戏下载数'],
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
      <div className="card border-0 shadow-sm h-100">
        <div className="card-header bg-white border-0">
          <div className="fw-semibold">{cfg?.title || ''}</div>
          <div className="mt-1">
            <UpdateTag text={updateLabel} />
          </div>
        </div>
        <div className="card-body">
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
        </div>
      </div>
    </div>
  );
}

/** 热门游戏TopN下载日趋势卡片（上周 vs 本周，本周加粗实线、上周虚线，占剩余 65%） */
function WeeklyTrendCard({ chartKey, data, loading, error, updateLabel, notice }) {
  const cfg = WEEKLY_TREND_CHARTS[chartKey];
  const categories = data?.categories || [];
  // 数据点用 [x=0~6, y] 数值对，缺数据的日期直接不画点（参照【广告大盘】日趋势的做法）。
  // category 轴 + 含 null 的数组会让 Apex 把「折线几何」和「轴标签」算成两套间距，导致整体右偏。
  const toPairs = (arr) => (arr || []).map((v, i) => (v == null ? null : [i, Number(v)])).filter(Boolean);
  const series = [];
  const colorList = [];
  cfg.pairs(data).forEach(([cur, prev], i) => {
    series.push({ name: `${cfg.names[i]}（本周）`, data: toPairs(cur) });
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
    const rows = series
      .map((s, i) => {
        const raw = valueAt(rawSeries?.[i], dataPointIndex);
        const value = raw == null || Number.isNaN(Number(raw)) ? '-' : formatNumber(Number(raw));
        return `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
          <span style="display:inline-flex;align-items:center;gap:6px;">
            <span style="width:8px;height:8px;border-radius:2px;background:${colorList[i]};display:inline-block;"></span>
            <span>${s.name}</span>
          </span>
          <span style="font-weight:600;">${value}</span>
        </div>`;
      })
      .join('');
    return `<div style="padding:6px 4px;font-size:12px;line-height:1.7;min-width:210px;">
      <div style="font-weight:600;margin-bottom:4px;">${xLabel}</div>
      ${rows}
    </div>`;
  };

  return (
    <div className="col-12 tt-split-65">
      <div className="card border-0 shadow-sm h-100">
        <div className="card-header bg-white border-0 d-flex align-items-start justify-content-between gap-2 flex-wrap">
          <div>
            <div className="fw-semibold">{cfg.title}</div>
            <div className="mt-1">
              <UpdateTag text={updateLabel} />
            </div>
          </div>
          {notice ? (
            <div className="ms-auto">
              <ChartNotice compact>{notice}</ChartNotice>
            </div>
          ) : null}
        </div>
        <div className="card-body">
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
        </div>
      </div>
    </div>
  );
}

export default function DownloadStats() {
  const [selectedTable, setSelectedTable] = useState('dws_taptap_download_hourly');
  const [selectedWindow, setSelectedWindow] = useState(() => formatNowWindow('hour'));
  // 饼图 ↔ 明细表联动：平台默认选中 APP（refer='app'），游戏类型默认选中 TapMaker（distribution_type=2）
  const [platformFilter, setPlatformFilter] = useState('app');
  const [typeFilter, setTypeFilter] = useState(2);

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
  const weeklyTrendQuery = useSqlQuery('taptap-weekly-trend', buildWeeklyTrendSql, [], transformWeeklyTrend, { enabled: true });
  const monthlyBreakdownQuery = useSqlQuery('taptap-monthly-breakdown', buildMonthlyBreakdownSql, [], transformMonthlyBreakdown, { enabled: true });
  const distributionByWindowQuery = useSqlQuery('taptap-distribution-by-window', () => buildDistributionByWindowSql(selectedTable, selectedWindow), [selectedTable, selectedWindow], transformDistributionByWindow, { enabled: true });
  const newestDateQuery = useSqlQuery('taptap-newest-date', buildNewestDateSql, [], transformNewestDate);

  const top25DetailQueries = {
    platform: useTop25DetailQuery('platform', TOP25_DETAIL_TABLES.platform, selectedTable, selectedWindow, true, {
      // 全部 = APP+PC 全平台
      referFilter: platformFilter == null ? 'all' : platformFilter,
    }),
    gameType: useTop25DetailQuery('gameType', TOP25_DETAIL_TABLES.gameType, selectedTable, selectedWindow, true, {
      // 全部 = 全部小游戏（distribution_type IN (1,2)），不是「所有游戏类型」
      typeFilter: typeFilter == null ? 'all' : typeFilter,
    }),
  };

  // 两份明细里实际出现的 app_id（去重），名称/图标/标签只按这些 ID 捞，减少查询体量
  const detailAppIds = useMemo(() => {
    const set = new Set();
    [top25DetailQueries.platform.data, top25DetailQueries.gameType.data].forEach((d) => {
      (d?.rows || []).forEach((r) => {
        if (r.appId != null) set.add(String(r.appId));
      });
    });
    return [...set];
  }, [top25DetailQueries.platform.data, top25DetailQueries.gameType.data]);

  // 两份明细都回来后再一次性捞名称，避免先按一份明细发请求、随后再补一次
  const detailReady = top25DetailQueries.platform.isSuccess && top25DetailQueries.gameType.isSuccess;
  const gameNameQuery = useSqlQuery(
    'taptap-game-name-map',
    () => buildGameNameSql(detailAppIds),
    [detailAppIds.join(',')],
    transformGameNameMap,
    { enabled: detailReady && detailAppIds.length > 0, placeholderData: (prev) => prev }
  );

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
    if (selectedTable === 'dws_taptap_download_hourly' && newestDateQuery.data) {
      setSelectedWindow(newestDateQuery.data);
    }
  }, [newestDateQuery.data, selectedTable]);

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
          notice="小游戏口径由于 11 月 3 日开始上游的调整，要进行调整，预计 11 月 7 号开始数据统计才有参考意义"
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
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-0">
                  <div className="fw-semibold">{dist?.title || ''}</div>
                  <div className="mt-1">
                    <UpdateTag text={windowUpdateLabel} />
                  </div>
                  <div className="d-flex align-items-center gap-1 mt-2 flex-wrap">
                    <span className="text-muted" style={{ fontSize: 11 }}>
                      明细筛选
                    </span>
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
                </div>
                <div className="card-body d-flex flex-column align-items-center justify-content-center">
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
                </div>
              </div>
            </div>

            {/* 下载TopN明细（占剩余 65%） */}
            <div className="col-12 tt-split-65">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-0">
                  <div className="fw-semibold">{TOP25_DETAIL_TABLES[tableKey].title}</div>
                  <div className="mt-1">
                    <UpdateTag text={windowUpdateLabel} />
                  </div>
                </div>
                <DataTable
                  rows={tableKey === 'gameType' ? gameTypeRows : platformRows}
                  columns={TOP25_DETAIL_COLUMNS(gameNameQuery.data, {
                    withOneSearch: true,
                    withPlatform: !!TOP25_DETAIL_TABLES[tableKey].withPlatform,
                    withType: !!TOP25_DETAIL_TABLES[tableKey].withType,
                  })}
                  tableClassName="top25-table"
                  fixedLayout
                  rankColWidth={TOP25_DETAIL_TABLES[tableKey].rankWidth || '6%'}
                />
              </div>
            </div>
          </div>
        );
      })}

    </>
  );
}
