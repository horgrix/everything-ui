import { useState, useEffect, useMemo } from 'react';
import BarChart from '../../components/charts/BarChart';
import LineChart from '../../components/charts/LineChart';
import PieChart from '../../components/charts/PieChart';
import { formatNumber, formatCompactNumber } from '../../utils/formatters';
import UpdateTag from './UpdateTag';
import { nextUpdateTime, formatNextUpdate } from './updateTime';
import {
  buildAggregateSql,
  buildDailyTrendSql,
  buildMonthlyBreakdownSql,
  buildDistributionByWindowSql,
  buildTop25DetailSql,
  buildGameNameSql,
  buildNewestDateSql,
} from './sql';
import {
  transformAggregate,
  transformDailyTrend,
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

/** 月趋势拆分图（平台 / 游戏类型）配置 */
const MONTHLY_BREAKDOWN_CHARTS = [
  { key: 'platform', title: '热门游戏TopN下载月趋势(平台) — 最近12个月' },
  { key: 'gameType', title: '热门游戏TopN下载月趋势(游戏类型) — 最近12个月' },
];

/** 追踪的游戏分布拆分图（平台 / 游戏类型）配置 */
const DISTRIBUTION_CHARTS = [
  { key: 'platform', title: '追踪的游戏分布(平台)' },
  { key: 'gameType', title: '追踪的游戏分布(游戏类型)' },
];

/* ===== 图表配色（均取自 AD_MATERIAL_COLORS 色库） ===== */
/** 平台拆分：APP / PC */
const PLATFORM_DOWNLOAD_COLORS = ['#7A8B99', '#9CAF9F'];
/** 「下载平台」标签配色：APP / PC / APP+PC 各自区分（取自同一色库） */
const PLATFORM_BADGE_COLORS = { app: '#7A8B99', pc: '#9CAF9F', 'app+pc': '#B08B8B' };
/** 「游戏类型」标签文案与配色（0=商业游戏、2=TapMaker） */
const DISTRIBUTION_TYPE_LABELS = { 0: '商业游戏', 1: '创意工坊', 2: 'TapMaker' };
const DISTRIBUTION_TYPE_BADGE_COLORS = { 0: '#8FA3B0', 1: '#C9B79C', 2: '#9B93A8' };
/** 月趋势两个拆分图各自的配色（APP/PC、商业游戏/TapMaker） */
const MONTHLY_BREAKDOWN_COLORS = {
  platform: ['#7A8B99', '#9CAF9F'],
  gameType: ['#8FA3B0', '#9B93A8'],
};
/** 日趋势 7 条折线：按色库循环 */
const DAILY_TREND_COLORS = AD_MATERIAL_COLORS;
/** 分布饼图扇区：按色库循环 */
const DISTRIBUTION_COLORS = AD_MATERIAL_COLORS;

/** 下载Top25明细拆分表配置 */
const TOP25_DETAIL_TABLES = {
  // 平台版：APP / PC 各取 Top50 再合并（小时按 refer，日/月按 app / pc 下载数）
  platform: { title: '下载Top100明细(平台)', limit: 100, splitTop: { size: 50, mode: 'platform' }, withPlatform: true, rankWidth: '5%' },
  // 游戏类型版：distribution_type 0（商业游戏）/ 2（TapMaker）各取 Top50 再合并
  gameType: { title: '下载Top100明细(游戏类型)', limit: 100, splitTop: { size: 50, mode: 'type' }, withType: true, rankWidth: '5%' },
};

/** OneSearch 线索查询路由（站内相对路径，开发/生产都指向当前站点，用 APPID 拼接 q 参数） */
const ONESEARCH_REPORT_PATH = '/one-search/report';

/**
 * 下载Top25明细表格列（游戏名称 / icon / 标签 从全局映射获取）
 * @param {Object} gameMap app_id -> { name, icon, tags }
 * @param {boolean} withOneSearch 是否在「下载数」后追加 OneSearch 跳转列（仅 APP / PC 两张宽表）
 */
const TOP25_DETAIL_COLUMNS = (gameMap, { withOneSearch = false, withPlatform = false, withType = false } = {}) => {
  // 列宽分摊（rank 列宽由调用方传入）：带附加列（下载平台 / 游戏类型）时按 5/10/30/10/25/10/10 分配
  const W = withPlatform || withType
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
function useTop25DetailQuery(key, table, selectedTable, selectedWindow, enabled) {
  return useSqlQuery(
    `taptap-top25-${key}`,
    () => buildTop25DetailSql(selectedTable, selectedWindow, table),
    [selectedTable, selectedWindow],
    transformTop25Detail,
    { enabled }
  );
}

export default function DownloadStats() {
  const [selectedTable, setSelectedTable] = useState('dws_taptap_download_hourly');
  const [selectedWindow, setSelectedWindow] = useState(() => formatNowWindow('hour'));

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
  const dailyTrendQuery = useSqlQuery('taptap-daily-trend', buildDailyTrendSql, [], transformDailyTrend, { enabled: true });
  const monthlyBreakdownQuery = useSqlQuery('taptap-monthly-breakdown', buildMonthlyBreakdownSql, [], transformMonthlyBreakdown, { enabled: true });
  const distributionByWindowQuery = useSqlQuery('taptap-distribution-by-window', () => buildDistributionByWindowSql(selectedTable, selectedWindow), [selectedTable, selectedWindow], transformDistributionByWindow, { enabled: true });
  const newestDateQuery = useSqlQuery('taptap-newest-date', buildNewestDateSql, [], transformNewestDate);

  const top25DetailQueries = {
    platform: useTop25DetailQuery('platform', TOP25_DETAIL_TABLES.platform, selectedTable, selectedWindow, true),
    gameType: useTop25DetailQuery('gameType', TOP25_DETAIL_TABLES.gameType, selectedTable, selectedWindow, true),
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

  // 数据最新时间加载后，小时选项的统计窗口默认值同步为最新数据时间，避免数据更新期间空白
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

      {/* 热门游戏TopN下载月趋势（平台/AI 并排） */}
      <div className="row g-3 mb-4">
        {MONTHLY_BREAKDOWN_CHARTS.map((c) => (
          <div className="col-12 col-md-6" key={c.key}>
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
            xaxisOverrides={(() => {
              const cats = dailyTrendQuery.data?.categories;
              if (!cats) return {};
              // 30 天逐日 → 每 5 天显示一个刻度，其余留空，避免日期挤成一片
              const shown = new Set(cats.filter((_, i) => i % 5 === 0 || i === cats.length - 1));
              return {
                type: 'category',
                categories: cats,
                labels: { rotate: 0, formatter: (v) => (shown.has(v) ? String(v).slice(5) : '') },
              };
            })()}
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

      {/* 追踪的游戏分布（平台/AI 并排） */}
      {/* 分布饼图 + Top25 明细：两两一行，顺序为 平台｜APP 明细、游戏类型｜PC 明细 */}
      {[
        ['platform', 'platform'],
        ['gameType', 'gameType'],
      ].map(([distKey, tableKey]) => {
        const dist = DISTRIBUTION_CHARTS.find((c) => c.key === distKey);
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
                </div>
                <div className="card-body d-flex flex-column align-items-center justify-content-center">
                  <PieChart
                    series={distributionByWindowQuery.data?.[distKey]?.series || []}
                    labels={distributionByWindowQuery.data?.[distKey]?.labels || []}
                    loading={distributionByWindowQuery.isLoading}
                    error={distributionByWindowQuery.error?.message}
                    height={300}
                    donut
                    colors={DISTRIBUTION_COLORS}
                    legendOverrides={{ horizontalAlign: 'center' }}
                    totalLabel={distributionByWindowQuery.data?.[distKey]?.totalLabel}
                    totalValue={distributionByWindowQuery.data?.[distKey]?.totalValue}
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
                  rows={top25DetailQueries[tableKey].data?.rows || []}
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
