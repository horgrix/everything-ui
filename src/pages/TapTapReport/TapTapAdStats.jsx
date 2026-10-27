/**
 * TapTap广告统计
 * - 【广告大盘】日趋势：本周 vs 上周（x=星期几，本周实线加粗 / 上周虚线）
 * - 其余指标待接入（数据表与口径确认后替换占位）
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
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
  lastMonthLabel,
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
import RankTopCard from './components/RankTopCard';
import CurrentHourAdTips from './components/CurrentHourAdTips';
import { APP_AD_TAG_COLORS, truncateName, PercentBar, GameIcon, taptapAppUrl } from './shared';

/**
 * 指标定义：本周实线加粗（深色）、上周虚线细线（浅色），全部走左 Y 轴。
 * 口径：广告数 = ad_views + pcebid_views；APP / PC / KW 广告数同口径（已在 SQL 里加好）。
 */
const METRIC_DEFS = [
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
  {
    header: 'APPID',
    width: '6%',
    accessor: (r) => r.appId,
    render: (r) =>
      r.appId === '-' ? (
        <span className="text-muted">-</span> // 汇总行不发链接
      ) : (
        <a
          href={taptapAppUrl(r.appId)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-decoration-none"
          style={{ color: '#4361ee' }}
          title={`在 TapTap 打开 ${r.appName || ''}（APPID ${r.appId}）`}
        >
          {r.appId}
        </a>
      ),
  },
  {
    header: '游戏名称',
    width: '12%',
    accessor: (r) => r.appName,
    render: (r) => (
      <span className="d-inline-flex align-items-center gap-2" title={r.appName || undefined} style={{ whiteSpace: 'nowrap' }}>
        {r.appId !== '-' && <GameIcon src={r.icon} size={20} alt={r.appName ? `${r.appName} 图标` : ''} />}
        <span className="fw-semibold">{truncateName(r.appName)}</span>
      </span>
    ),
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

/** 周几（与 x 轴数值 0~6 对应） */
const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/**
 * 由 transform 结果生成 series / colors / strokeWidths / dashArray（四组一一对应）。
 * 数据点是 [x=0~6, y] 的数值对而不是纯 y 数组：Apex 在 category 轴 + 含 null 的序列下
 * 会把「折线几何」和「x 轴标签」算成两套间距（标签按 7 段、折线按 6 段），导致图像右偏、
 * 与坐标轴对不齐。改用数值轴后，点和标签都由同一套坐标算，缺数据的日期直接不画点。
 */
function buildChartSeries(data) {
  const series = [];
  const colors = [];
  const widths = [];
  const dashArray = [];
  const toPairs = (arr) => (arr || []).map((v, i) => (v == null ? null : [i, v])).filter(Boolean);
  METRIC_DEFS.forEach((def) => {
    series.push({ name: `${def.label} 本周`, type: 'line', data: toPairs(data.thisWeek[def.key]) });
    series.push({ name: `${def.label} 上周`, type: 'line', data: toPairs(data.lastWeek[def.key]) });
    colors.push(def.color, def.lastColor);
    widths.push(3, 1.6);
    dashArray.push(0, 6);
  });
  return { series, colors, widths, dashArray };
}

/**
 * 大盘指标说明（资源位 / 采集频率 / 命中含义）
 * 展示在【广告大盘】日趋势之上，说明曝光与广告数是怎么来的。
 */
function AdMetricHint() {
  const PLATFORM_TAGS = [
    { platform: 'IOS & Android', items: ['首页推荐', '搜索发现', '热搜', '热点'] },
    { platform: 'PC', items: ['每日发现', 'Top橱窗'] },
  ];

  const Row = ({ label, children }) => (
    <div className="d-flex flex-wrap gap-2" style={{ lineHeight: 1.9 }}>
      <span style={{ minWidth: 72, flexShrink: 0, color: '#495057', fontWeight: 600 }}>
        {label}
      </span>
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        {children}
      </div>
    </div>
  );

  return (
    <div
      className="d-flex gap-2 mb-3 px-3 py-2 rounded-3"
      style={{ backgroundColor: '#F7F9FC', border: '1px solid #E5EAF0', borderLeft: '3px solid #4361ee' }}
    >
      <i className="bi bi-info-circle text-primary" style={{ fontSize: 15, lineHeight: '28px' }}></i>
      <div className="small text-body flex-grow-1" style={{ minWidth: 0 }}>
        <Row label="资源位">
          <div className="d-flex flex-column" style={{ gap: 2 }}>
            {PLATFORM_TAGS.map((group) => (
              <div key={group.platform} className="d-flex flex-wrap align-items-center" style={{ gap: '4px 6px' }}>
                <span className="fw-semibold text-dark" style={{ minWidth: 92 }}>{group.platform}</span>
                {group.items.map((item) => (
                  <span
                    key={item}
                    className="badge fw-normal"
                    style={{ backgroundColor: '#E7EDF5', color: '#33415C', fontSize: 11, padding: '3px 7px' }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </Row>
        <Row label="采集频率">
          <span>1 小时 1 次</span>
        </Row>
        <Row label="命中的含义">
          <span>该小时广告出现在资源位；所以每个资源位每天最大值为 24</span>
        </Row>
      </div>
    </div>
  );
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

  const lastWeekTopQuery = useSqlQuery(
    'taptap-ad-rank-top-last-week',
    () => buildAdRankTopSql('weekly', 10, lastWeekRankKey()),
    [],
    transformAdRankTop,
    { enabled: true },
  );
  const lastMonthTopQuery = useSqlQuery(
    'taptap-ad-rank-top-last-month',
    () => buildAdRankTopSql('monthly', 10, lastMonthLabel()),
    [],
    transformAdRankTop,
    { enabled: true },
  );

  /**
   * 日趋势 tooltip：按「同一个 x（周几）」列出全部 6 条线的 y 值。
   * Apex 默认在鼠标压到 marker 上时只显示当前系列，用自定义 tooltip 统一成整列读数。
   */
  const trendTooltip = ({ series, dataPointIndex }) => {
    const rows = chart.series
      .map((s, i) => {
        const raw = series?.[i]?.[dataPointIndex];
        const value = raw == null || Number.isNaN(Number(raw)) ? '-' : formatNumber(raw);
        return `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
          <span style="display:inline-flex;align-items:center;gap:6px;">
            <span style="width:8px;height:8px;border-radius:2px;background:${chart.colors[i]};display:inline-block;"></span>
            <span>${s.name}</span>
          </span>
          <span style="font-weight:600;">${value}</span>
        </div>`;
      })
      .join('');
    return `<div style="padding:6px 4px;font-size:12px;line-height:1.7;min-width:190px;">
      <div style="font-weight:600;margin-bottom:4px;">${WEEKDAYS[dataPointIndex] ?? ''}</div>
      ${rows}
    </div>`;
  };

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
      {/* 指标说明：资源位 / 采集频率 / 命中含义 */}
      <AdMetricHint />

      {/* 第一行：日趋势（75%）+ 广告占比（25%） */}
      <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
        <div style={{ flex: '75 1 0', minWidth: 0 }}>
          {/* 【广告大盘】日趋势：本周 vs 上周 */}
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <div className="fw-semibold">【广告大盘】日趋势 — 本周 vs 上周</div>
              <div className="d-flex align-items-center flex-wrap gap-2 mt-1">
                <span className="text-muted small">
                  x=星期几；APP / PC / KW 广告数（各端 = *_ad_views + *_pcebid_views）；本周实线加粗，上周虚线
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
                markers={{ size: 6, hover: { size: 12 } }}
                /* 折线图不需要面积填充；不显式拉满时 Apex 6 会把 fill.opacity 数组带到 stroke 上，折线变半透明 */
                fill={{ opacity: 1 }}
                xaxisOverrides={{
                  type: 'numeric',
                  min: 0,
                  max: 6,
                  tickAmount: 6,
                  labels: {
                    rotate: 0,
                    formatter: (v) => WEEKDAYS[Math.round(v)] ?? '',
                  },
                }}
                tooltipCustom={trendTooltip}
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
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div className="fw-semibold">【广告大盘】本周游戏明细 — Top20</div>
            {/* 相关报表快捷入口：切到同页其它广告统计标签（标签由 URL ?tab= 控制） */}
            <div className="d-flex align-items-center" style={{ gap: '1rem' }}>
              <CurrentHourAdTips />
              {[
                { to: '/taptap?tab=ad', label: 'TapPC广告统计' },
                { to: '/taptap?tab=appAd', label: 'TapApp广告统计' },
              ].map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="small text-decoration-none d-inline-flex align-items-center gap-1 fw-semibold"
                  style={{ color: '#4361ee' }}
                >
                  {link.label}
                  <i className="bi bi-arrow-right" style={{ fontSize: 11 }}></i>
                </Link>
              ))}
            </div>
          </div>
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
        <div style={{ flex: '50 1 0', minWidth: 0 }}>
          <RankTopCard
            title="【广告大盘】今日投放 Top10"
            subtitle="rank_type=daily；y=游戏名称（名次. 名称），x=总投放（APP + PC + KV 堆叠，柱端为合计）"
            rangeLabel="数据日期"
            snapshot={todayTopQuery.data?.snapshot}
            rows={todayTopQuery.data?.rows || []}
            loading={todayTopQuery.isLoading}
            error={todayTopQuery.error?.message}
            emptyText="今日排名快照暂无数据"
            height={500}
          />
        </div>
        <div style={{ flex: '50 1 0', minWidth: 0 }}>
          <RankTopCard
            title="【广告大盘】本月投放 Top10"
            subtitle="rank_type=monthly；y=游戏名称（名次. 名称），x=总投放（APP + PC + KV 堆叠，柱端为合计）"
            rangeLabel="数据月份"
            snapshot={monthTopQuery.data?.snapshot}
            rows={monthTopQuery.data?.rows || []}
            loading={monthTopQuery.isLoading}
            error={monthTopQuery.error?.message}
            emptyText="本月排名快照暂无数据"
            height={500}
          />
        </div>
      </div>

      {/* 第四行：上周 / 上月投放 Top10（各占 50%） */}
      <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
        <div style={{ flex: '50 1 0', minWidth: 0 }}>
          {(() => {
            const official = lastWeekTopQuery.data;
            const derived = rankDerivedQuery.data;
            const fromOfficial = (official?.rows || []).length > 0;
            const rows = fromOfficial ? official.rows.slice(0, 10) : (derived?.rows || []).slice(0, 10);
            return (
              <RankTopCard
                title="【广告大盘】上周投放 Top10"
                subtitle="rank_type=weekly；y=游戏名称（名次. 名称），x=总投放（APP + PC + KV 堆叠，柱端为合计）"
                rangeLabel="数据周"
                snapshot={fromOfficial ? official.snapshot : lastWeekRankKey()}
                sourceNote={fromOfficial ? '' : '官方快照未入库，按明细表上周总投放推算'}
                rows={rows}
                loading={lastWeekTopQuery.isLoading || (!fromOfficial && rankDerivedQuery.isLoading)}
                error={lastWeekTopQuery.error?.message}
                emptyText={`上周（${lastWeekRankKey()}）排名快照暂无数据`}
                height={500}
              />
            );
          })()}
        </div>
        <div style={{ flex: '50 1 0', minWidth: 0 }}>
          <RankTopCard
            title="【广告大盘】上月投放 Top10"
            subtitle="rank_type=monthly；y=游戏名称（名次. 名称），x=总投放（APP + PC + KV 堆叠，柱端为合计）"
            rangeLabel="数据月份"
            snapshot={lastMonthTopQuery.data?.snapshot || lastMonthLabel()}
            rows={lastMonthTopQuery.data?.rows || []}
            loading={lastMonthTopQuery.isLoading}
            error={lastMonthTopQuery.error?.message}
            emptyText={`上月（${lastMonthLabel()}）排名快照尚未入库`}
            height={500}
          />
        </div>
      </div>
    </>
  );
}
