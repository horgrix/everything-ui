/**
 * TapTap广告统计
 * - 【广告大盘】日趋势：本周 vs 上周（x=星期几，本周实线加粗 / 上周虚线）
 * - 其余指标待接入（数据表与口径确认后替换占位）
 */
import { useMemo } from 'react';
import MixedChart from '../../components/charts/MixedChart';
import BarChart from '../../components/charts/BarChart';
import SparkStackBar from '../../components/common/SparkStackBar';
import Sparkline from '../../components/common/Sparkline';
import { formatNumber, formatCompactNumber } from '../../utils/formatters';
import {
  buildAdAggrDailyTrendSql,
  buildAdShareByWeekSql,
  buildAdGameWeeklyTopSql,
  buildAdAggrGameDailyTrendSql,
  buildAdOverviewWeekSql,
  buildAdOverviewDailyTrendSql,
  buildAdRankWeekSql,
  buildAdRankDerivedWeekSql,
  buildAdRankTopSql,
  lastWeekRankKey,
  thisWeekWhere,
} from './sql';
import {
  transformAdAggrDailyTrend,
  transformAdShareByWeek,
  transformAdGameWeeklyTop,
  transformAdGameDailyTrend,
  transformAdOverviewWeek,
  transformAdOverviewDailyTrend,
  transformAdRankWeek,
  transformAdRankDerivedWeek,
  transformAdRankTop,
} from './transforms';
import { useSqlQuery } from './queries';
import DataTable from './components/DataTable';
import { APP_AD_TAG_COLORS, truncateName, PercentBar } from './shared';

/**
 * 指标定义：本周实线加粗（深色）、上周虚线细线（浅色），全部走左 Y 轴。
 * 口径：广告数 = ad_views + pcebid_views；APP / PC / KW 广告数同口径（已在 SQL 里加好）。
 */
const METRIC_DEFS = [
  { label: '广告数', key: 'adViews', color: '#0f9d8a', lastColor: '#8ed6cb' },
  { label: 'APP广告数', key: 'appAdViews', color: '#f08c00', lastColor: '#f7c98b' },
  { label: 'PC广告数', key: 'pcAdViews', color: '#7209b7', lastColor: '#c396e0' },
  { label: 'KW广告数', key: 'kwAdViews', color: '#d6336c', lastColor: '#eda2bb' },
];

/** 广告占比三段：与趋势图同色（APP 橙 / PC 紫 / KW 品红），堆叠自下而上 */
const SHARE_SEGMENTS = [
  { label: 'APP广告数', key: 'app', color: '#f08c00' },
  { label: 'PC广告数', key: 'pc', color: '#7209b7' },
  { label: 'KW广告数', key: 'kw', color: '#d6336c' },
];

/** 占比图 series + 各段占比矩阵（pcts[seriesIndex][dataPointIndex]），供 dataLabels formatter 查表 */
function buildShareChart(data) {
  const weeks = data?.weeks || [];
  return {
    categories: data?.categories || ['本周', '上周'],
    series: SHARE_SEGMENTS.map((seg) => ({ name: seg.label, data: weeks.map((w) => w[seg.key]) })),
    pcts: SHARE_SEGMENTS.map((seg) => weeks.map((w) => w.pcts[seg.key] ?? null)),
    colors: SHARE_SEGMENTS.map((seg) => seg.color),
  };
}

/** 平台配色（与占比图一致）：APP 橙 / PC 紫 / KW 品红 */
const PLATFORM_COLORS = { app: '#f08c00', pc: '#7209b7', kw: '#d6336c' };

/** 游戏明细表里的 spark 列：每列一条堆叠条，segments 依次为自左向右的堆叠段 */
const SPARK_COLUMNS = [
  {
    header: '曝光构成',
    segs: [
      { label: 'APP首页曝光', field: 'appViews', color: PLATFORM_COLORS.app },
      { label: 'PC首页曝光', field: 'pcViews', color: PLATFORM_COLORS.pc },
      { label: '搜索页曝光', field: 'kwViews', color: PLATFORM_COLORS.kw },
    ],
  },
  {
    header: '商业AD',
    segs: [
      { label: 'APP商业广告', field: 'appAdViews', color: PLATFORM_COLORS.app },
      { label: 'PC商业广告', field: 'pcAdViews', color: PLATFORM_COLORS.pc },
      { label: '关键词商业广告', field: 'kwAdViews', color: PLATFORM_COLORS.kw },
    ],
  },
  {
    header: '资源互换AD',
    segs: [
      { label: 'APP资源互换', field: 'appPcebidViews', color: PLATFORM_COLORS.app },
      { label: 'PC资源互换', field: 'pcPcebidViews', color: PLATFORM_COLORS.pc },
      { label: '关键词资源互换', field: 'kwPcebidViews', color: PLATFORM_COLORS.kw },
    ],
  },
  {
    header: '总投放',
    segs: [
      { label: '商业AD', field: 'adViews', color: '#7A8B99' },
      { label: '资源互换AD', field: 'pcebidViews', color: '#B08B8B' },
    ],
  },
];

/** 本周游戏明细 Top20 列配置 */
const GAME_TOP_COLUMNS = [
  { header: 'APPID', width: '5%', accessor: (r) => r.appId, render: (r) => <span className="text-muted small">{r.appId}</span> },
  {
    header: '游戏名称',
    width: '10%',
    accessor: (r) => r.appName,
    render: (r) => <span className="fw-semibold" title={r.appName || undefined} style={{ whiteSpace: 'nowrap' }}>{truncateName(r.appName)}</span>,
  },
  {
    header: '标签',
    width: '11%',
    accessor: (r) => r.tags.join(' '),
    render: (r) => (
      <div className="d-flex flex-wrap gap-1">
        {r.tags.length === 0 && <span className="text-muted">-</span>}
        {r.tags.map((tag, i) => (
          <span key={`${tag}-${i}`} className="badge" style={{ backgroundColor: APP_AD_TAG_COLORS[`tag${i + 1}`], color: '#fff' }}>{tag}</span>
        ))}
      </div>
    ),
  },
  {
    header: '上周投放排名',
    align: 'center',
    width: '8%',
    accessor: (r) => r.lastWeekRank ?? null,
    help: '上周（上一自然周）投放排名：优先取 dws_taptap_ad_rank_v4_daily 的 weekly 快照；该周快照未入库时，按上周总投放倒序推算。app_id 命中显示名次，否则「未上榜」',
    render: (r) => {
      if (r.appId === '-') return <span className="text-muted">-</span>; // 汇总行
      if (r.lastWeekRank == null) return <span className="text-muted">未上榜</span>;
      const cls = r.lastWeekRank === 1 ? 'bg-warning text-dark' : r.lastWeekRank === 2 ? 'bg-secondary' : r.lastWeekRank === 3 ? 'bg-danger' : 'bg-light text-secondary border';
      return <span className={`badge ${cls}`}>{r.lastWeekRank}</span>;
    },
  },
  { header: '总曝光', align: 'end', width: '6%', accessor: (r) => r.totalViews, render: (r) => <span>{formatNumber(r.totalViews)}</span> },
  ...SPARK_COLUMNS.map((col) => ({
    header: col.header,
    align: 'center',
    width: col.segs.length === 2 ? '9%' : '10%',
    help: col.segs.map((seg) => ({ color: seg.color, text: seg.label })),
    render: (r) => (
      <SparkStackBar segments={col.segs.map((seg) => ({ label: seg.label, value: r[seg.field], color: seg.color }))} />
    ),
  })),
  {
    header: '本周趋势',
    align: 'center',
    width: '11%',
    help: 'y=每日总投放（商业AD + 资源互换AD），x=周几；本周实线加粗，上周虚线对比',
    render: (r) => (
      <Sparkline data={r.trend} prevData={r.prevTrend} labels={r.trendLabels} currentLabel="本周" prevLabel="上周" width={100} height={32} />
    ),
  },
  {
    header: '广告贡献度',
    align: 'center',
    width: '9%',
    help: '广告贡献度 = 本游戏总投放 / 全站本周总投放（汇总行 total_push，来自 dws_taptap_ad_overview_v4_daily）',
    render: (r) => <PercentBar value={r.share} color="#8FA3B0" />,
  },
];

/** 由 transform 结果生成 series / colors / strokeWidths / dashArray（四组一一对应） */
function buildChartSeries(data) {
  const series = [];
  const colors = [];
  const widths = [];
  const dashArray = [];
  METRIC_DEFS.forEach((def) => {
    series.push({ name: `${def.label} 本周`, type: 'line', data: data.thisWeek[def.key] });
    series.push({ name: `${def.label} 上周`, type: 'line', data: data.lastWeek[def.key] });
    colors.push(def.color, def.lastColor);
    widths.push(3, 1.6);
    dashArray.push(0, 6);
  });
  return { series, colors, widths, dashArray };
}

export default function TapTapAdStats() {
  const adAggrDailyTrendQuery = useSqlQuery(
    'taptap-ad-aggr-daily-trend',
    buildAdAggrDailyTrendSql,
    [],
    transformAdAggrDailyTrend,
    { enabled: true },
  );

  const adShareQuery = useSqlQuery(
    'taptap-ad-share-by-week',
    buildAdShareByWeekSql,
    [],
    transformAdShareByWeek,
    { enabled: true },
  );

  const gameTopQuery = useSqlQuery(
    'taptap-ad-game-weekly-top',
    buildAdGameWeeklyTopSql,
    [],
    transformAdGameWeeklyTop,
    { enabled: true },
  );

  const gameTrendQuery = useSqlQuery(
    'taptap-ad-game-daily-trend',
    buildAdAggrGameDailyTrendSql,
    [],
    transformAdGameDailyTrend,
    { enabled: true },
  );

  const overviewWeekQuery = useSqlQuery(
    'taptap-ad-overview-week',
    buildAdOverviewWeekSql,
    [],
    transformAdOverviewWeek,
    { enabled: true },
  );
  const overviewTrendQuery = useSqlQuery(
    'taptap-ad-overview-daily-trend',
    buildAdOverviewDailyTrendSql,
    [],
    transformAdOverviewDailyTrend,
    { enabled: true },
  );

  const rankWeekQuery = useSqlQuery(
    'taptap-ad-rank-week',
    buildAdRankWeekSql,
    [],
    transformAdRankWeek,
    { enabled: true },
  );
  // 官方上周快照为空时，用明细表现算上周排名兜底
  const rankDerivedQuery = useSqlQuery(
    'taptap-ad-rank-week-derived',
    buildAdRankDerivedWeekSql,
    [],
    transformAdRankDerivedWeek,
    { enabled: rankWeekQuery.isSuccess && !rankWeekQuery.data?.count },
  );

  const todayTopQuery = useSqlQuery(
    'taptap-ad-rank-top-daily',
    () => buildAdRankTopSql('daily', 10),
    [],
    transformAdRankTop,
    { enabled: true },
  );
  const monthTopQuery = useSqlQuery(
    'taptap-ad-rank-top-monthly',
    () => buildAdRankTopSql('monthly', 10),
    [],
    transformAdRankTop,
    { enabled: true },
  );

  const trendData = adAggrDailyTrendQuery.data;
  const chart = useMemo(() => buildChartSeries(trendData || transformAdAggrDailyTrend([])), [trendData]);
  const shareChart = useMemo(() => buildShareChart(adShareQuery.data || transformAdShareByWeek([])), [adShareQuery.data]);
  const gameRows = useMemo(() => {
    const list = gameTopQuery.data || [];
    const trend = gameTrendQuery.data;
    const labels = trend?.labels || [];
    const overviewPush = overviewWeekQuery.data?.totalPush || 0;
    const rank = rankWeekQuery.data?.count ? rankWeekQuery.data : rankDerivedQuery.data;
    return list.map((r) => ({
      ...r,
      trend: trend?.thisWeek?.[r.appId] || [],
      prevTrend: trend?.lastWeek?.[r.appId] || [],
      trendLabels: labels,
      // 广告贡献度 = 本游戏总投放 / 全站本周总投放（汇总行）
      share: overviewPush > 0 ? (r.totalPush / overviewPush) * 100 : null,
      lastWeekRank: rank?.byAppId?.[r.appId] ?? null,
    }));
  }, [gameTopQuery.data, gameTrendQuery.data, overviewWeekQuery.data, rankWeekQuery.data, rankDerivedQuery.data]);

  /** 汇总行：全站本周合计（overview 表），趋势同样取全站每日总投放 */
  const overviewTotalRow = useMemo(() => {
    const week = overviewWeekQuery.data;
    if (!week) return null;
    const trend = overviewTrendQuery.data;
    return {
      ...week,
      trend: trend?.thisWeek || [],
      prevTrend: trend?.lastWeek || [],
      trendLabels: trend?.labels || [],
      share: 100,
      lastWeekRank: null,
    };
  }, [overviewWeekQuery.data, overviewTrendQuery.data]);
  const hasLastWeek = !!trendData?.hasLastWeek;

  return (
    <>
      {/* 第一行：日趋势（75%）+ 广告占比（25%） */}
      <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
        <div style={{ flex: '75 1 0', minWidth: 0 }}>
          {/* 【广告大盘】日趋势：本周 vs 上周 */}
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <div className="fw-semibold">【广告大盘】日趋势 — 本周 vs 上周</div>
              <div className="d-flex align-items-center flex-wrap gap-2 mt-1">
                <span className="text-muted small">
                  x=星期几；广告数 = ad_views + pcebid_views（APP / PC / KW 广告数同口径）；本周实线加粗，上周虚线
                </span>
                {trendData?.range && (
                  <span className="text-muted small">
                    上周一起：{trendData.range.lastWeekStart} ~ 本周一起：{trendData.range.thisWeekStart}
                  </span>
                )}
              </div>
            </div>
            <div className="card-body">
              <MixedChart
                series={chart.series}
                loading={adAggrDailyTrendQuery.isLoading}
                error={adAggrDailyTrendQuery.error?.message}
                height={550}
                toolbar={false}
                colors={chart.colors}
                strokeWidths={chart.widths}
                strokeDashArray={chart.dashArray}
                /* 折线图不需要面积填充；不显式拉满时 Apex 6 会把 fill.opacity 数组带到 stroke 上，折线变半透明 */
                fill={{ opacity: 1 }}
                tooltipY={(v) => (v == null || Number.isNaN(Number(v)) ? '-' : formatNumber(v))}
                xaxisOverrides={{
                  type: 'category',
                  categories: trendData?.labels || ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
                  labels: { rotate: 0 },
                }}
                yaxisLeft={{
                  title: { text: '广告数' },
                  labels: { formatter: (v) => formatCompactNumber(v) },
                }}
                legend={{ position: 'bottom', horizontalAlign: 'center', fontSize: '12px', itemMargin: { horizontal: 12, vertical: 2 }, markers: { size: 4 } }}
                grid={{ padding: { top: 8, right: 34, bottom: 0, left: 8 } }}
              />
              {!adAggrDailyTrendQuery.isLoading && !adAggrDailyTrendQuery.error && !hasLastWeek && (
                <div className="text-muted small mt-2">
                  <i className="bi bi-info-circle me-1"></i>
                  上周（{trendData?.range?.lastWeekStart || '-'} 起）暂无广告数数据，上周虚线待数据补齐后自动显示
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ flex: '25 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <div className="fw-semibold">【广告大盘】广告占比</div>
              <div className="mt-1 text-muted small">
                x=本周 / 上周；柱顶=广告数合计，段内=占比
              </div>
            </div>
            <div className="card-body">
              <BarChart
                series={shareChart.series}
                loading={adShareQuery.isLoading}
                error={adShareQuery.error?.message}
                height={550}
                stacked
                shared
                totalLabels
                totalLabelFormatter={(val) => (val == null || Number.isNaN(Number(val)) ? '' : formatNumber(val))}
                dataLabelPosition="center"
                dataLabels={{
                  enabled: true,
                  formatter: (val, opts) => {
                    const p = shareChart.pcts?.[opts.seriesIndex]?.[opts.dataPointIndex];
                    return p == null ? '' : `${p}%`;
                  },
                  style: { fontSize: '11px', fontWeight: 600, colors: ['#ffffff'] },
                }}
                colors={shareChart.colors}
                toolbar={false}
                xaxisOverrides={{ categories: shareChart.categories, labels: { rotate: 0 } }}
                yaxisOverrides={{ labels: { formatter: (v) => formatCompactNumber(v) } }}
                legendOverrides={{ position: 'bottom', horizontalAlign: 'center', fontSize: '11px', itemMargin: { horizontal: 6, vertical: 2 }, markers: { size: 4 } }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 第二行：本周游戏明细 Top20 */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-0">
          <div className="fw-semibold">【广告大盘】本周游戏明细 — Top20</div>
          <div className="d-flex align-items-center flex-wrap gap-2 mt-1">
            <span className="text-muted small">
              按「总投放」倒序 → 「总曝光」倒序取前 20；总投放 = 商业AD(ad_views) + 资源互换AD(pcebid_views)
            </span>
            <span className="text-muted small">数据范围：本周（{thisWeekWhere(0)} 起）</span>
            <span className="text-muted small">
              上周排名周：{lastWeekRankKey()}
              {rankWeekQuery.data?.count
                ? '（官方 weekly 快照）'
                : rankDerivedQuery.data?.count
                  ? '（官方快照未入库，按明细表上周总投放推算）'
                  : ''}
            </span>
          </div>
        </div>
        {gameTopQuery.isLoading && <div className="card-body text-muted small">加载中…</div>}
        {gameTopQuery.error && (
          <div className="card-body text-danger small">
            <i className="bi bi-exclamation-triangle me-1"></i>
            {gameTopQuery.error.message}
          </div>
        )}
        {!gameTopQuery.isLoading && !gameTopQuery.error && (
          <DataTable rows={gameRows} columns={GAME_TOP_COLUMNS} pageSize={10} totalRow={overviewTotalRow} />
        )}
      </div>

      {/* 第三行：今日 / 本月投放 Top10（各占 50%） */}
      <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
        {[
          {
            key: 'today',
            title: '【广告大盘】今日投放 Top10',
            query: todayTopQuery,
            subtitle: 'rank_type=daily；y=游戏名称（名次. 名称），x=总投放（total_ad_veiws）',
            rangeLabel: '数据日期',
          },
          {
            key: 'month',
            title: '【广告大盘】本月投放 Top10',
            query: monthTopQuery,
            subtitle: 'rank_type=monthly；y=游戏名称（名次. 名称），x=总投放（total_ad_veiws）',
            rangeLabel: '数据月份',
          },
        ].map((item) => {
          const tops = item.query.data?.rows || [];
          return (
            <div key={item.key} style={{ flex: '50 1 0', minWidth: 0 }}>
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-0">
                  <div className="fw-semibold">{item.title}</div>
                  <div className="d-flex align-items-center flex-wrap gap-2 mt-1">
                    <span className="text-muted small">{item.subtitle}</span>
                    {item.query.data?.snapshot && (
                      <span className="text-muted small">{item.rangeLabel}：{item.query.data.snapshot}</span>
                    )}
                  </div>
                </div>
                <div className="card-body">
                  <BarChart
                    series={[{ name: '总投放', data: tops.map((r) => r.totalAdViews) }]}
                    loading={item.query.isLoading}
                    error={item.query.error?.message}
                    height={420}
                    horizontal
                    toolbar={false}
                    colors={['#8FA3B0']}
                    dataLabels={{
                      enabled: true,
                      style: { fontSize: '11px', fontWeight: 600, colors: ['#ffffff'] },
                    }}
                    /* 横向柱：xaxis.categories 是左侧分类轴，xaxis 数值刻度用紧凑格式；
                       不要给 yaxis.labels 加 formatter —— Apex 会把分类文案也丢进 formatter，非数字会被格式化掉 */
                    xaxisOverrides={{
                      categories: tops.map((r) => `${r.rank}. ${truncateName(r.appName)}`),
                      labels: { formatter: (v) => formatCompactNumber(Number(v)) },
                    }}
                    legendOverrides={{ show: false }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
