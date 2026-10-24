import { useRef } from 'react';
import useChartData from '../../hooks/useChartData';
import { querySqlV09 } from '../../api/query';
import BarChart from '../../components/charts/BarChart';
import LineChart from '../../components/charts/LineChart';
import BenchmarkSection from './BenchmarkSection';
import { formatCompactNumber } from '../../utils/formatters';

/** 数据表：TapREP 月度平台概要（爬虫-TapRep 生成，crawled_at 为 YYYY-MM） */
const TABLE = 'taptap_rep_summary_monthly';

/** 取最近 15 个月（按月键倒序取 15 行，转正序展示） */
const SUMMARY_SQL = `SELECT crawled_at,
       release_effect, release_login_sdk, release_op, release_pc, release_pc_emulator, release_adn,
       usage_inner, usage_outer
FROM ${TABLE}
ORDER BY crawled_at DESC
LIMIT 15`;

/**
 * 分组堆叠的 series 定义。
 * group 相同的 series 堆叠成一根柱子，不同 group 在同一个月份下并排（ApexCharts series.group）。
 * 顺序即堆叠顺序（自下而上）。
 */
const SERIES_DEFS = [
  { group: '资源发放', key: 'release_effect', name: '效果资源' },
  { group: '资源发放', key: 'release_login_sdk', name: '登录SDK' },
  { group: '资源发放', key: 'release_op', name: '运营资源' },
  { group: '资源发放', key: 'release_pc', name: 'PC资源' },
  { group: '资源发放', key: 'release_pc_emulator', name: 'PC模拟器资源' },
  { group: '资源发放', key: 'release_adn', name: 'ADN分账收益' },
  { group: '流量消耗', key: 'usage_inner', name: '站内计划消耗' },
  { group: '流量消耗', key: 'usage_outer', name: '站外投放计划消耗' },
];

/** 配色：资源发放用冷色系 6 档，流量消耗用暖色系 2 档，两组一眼能分开 */
const GROUP_COLORS = {
  资源发放: ['#7A8B99', '#9CAF9F', '#8FA3B0', '#9B93A8', '#7D8F7B', '#B4AEC0'],
  流量消耗: ['#B08B8B', '#C9B79C'],
};

/** 分组顺序（决定同一个月里左/右哪根柱） */
const GROUPS = [...new Set(SERIES_DEFS.map((d) => d.group))];
/** 与 BarChart 里 plotOptions.bar.columnWidth 的 '60%' 保持一致 */
const COLUMN_WIDTH = 0.6;

const SERIES_COLORS = SERIES_DEFS.map((def) => {
  const bucket = GROUP_COLORS[def.group];
  return bucket[SERIES_DEFS.filter((d) => d.group === def.group).indexOf(def) % bucket.length];
});

/** 广告效果两图：今年 vs 去年，按自然月 01~12 对齐 */
const NOW_YEAR = new Date().getFullYear();
const LAST_YEAR = NOW_YEAR - 1;
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

const EFFECT_SQL = `SELECT crawled_at,
       ad_effect_ctr, ad_effect_cvr, ad_effect_ctcvr,
       ad_effect_inner_cpa, ad_effect_outer_cpa
FROM ${TABLE}
WHERE crawled_at >= '${LAST_YEAR}-01'
ORDER BY crawled_at ASC`;

/** 两图共用同一个 chart.group 才能同步缩放/悬浮 */
const EFFECT_GROUP = 'taprep-effect';

/** benchmark 区块的三级联动维度（顺序即联动顺序） */
const AD_BENCH_DIMS = [
  { field: 'plan_group', label: '计划分组' },
  { field: 'plan_type', label: '计划类型' },
  { field: 'metric', label: '指标' },
];

const TAG_BENCH_DIMS = [
  { field: 'game_type', label: '游戏类型' },
  { field: 'tag_norm', label: '标签' },
  { field: 'metric', label: '指标' },
];

/**
 * 折线样式：每个指标两条线（今年实线加粗、去年虚线细线）。
 * 颜色同指标同色系，今年用深色、去年用浅色，光看图例也能分清年份。
 */
const EFFECT_METRICS = {
  ctr: { label: 'CTR', field: 'ad_effect_ctr', color: '#4361ee', lastColor: '#9bb1f7' },
  cvr: { label: 'CVR', field: 'ad_effect_cvr', color: '#0f9d8a', lastColor: '#8ed6cb' },
  ctcvr: { label: 'CTCVR', field: 'ad_effect_ctcvr', color: '#f08c00', lastColor: '#f7c98b' },
  innerCpa: { label: '站内计划综合CPA', field: 'ad_effect_inner_cpa', color: '#7209b7', lastColor: '#c396e0' },
  outerCpa: { label: '站投计划综合CPA', field: 'ad_effect_outer_cpa', color: '#118ab2', lastColor: '#7ec4d6' },
};

/** 空值保持 null（该月未采集），不补 0 —— 补 0 会让折线/柱体看起来像“确实是 0” */
function toNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function transformSummary(rows) {
  const asc = [...(rows || [])].sort((a, b) => String(a.crawled_at).localeCompare(String(b.crawled_at)));
  const categories = asc.map((r) => String(r.crawled_at).replace('-', '/'));
  const series = SERIES_DEFS.map((def) => ({
    name: def.name,
    group: def.group,
    data: asc.map((r) => toNum(r[def.key])),
  }));
  return {
    categories,
    series,
    months: asc.map((r) => r.crawled_at),
    /* 每组每月的合计：groupTotals[group][月份下标] */
    groupTotals: buildGroupTotals(series),
  };
}

/** 广告效果两年对比：每月一条曲线（今年实线、去年虚线），缺失月份留 null */
function transformEffect(rows) {
  const byYear = { [NOW_YEAR]: new Map(), [LAST_YEAR]: new Map() };
  (rows || []).forEach((r) => {
    const [year, month] = String(r.crawled_at).split('-');
    const bucket = byYear[Number(year)];
    if (bucket) bucket.set(month, r);
  });

  const seriesOf = (metrics, { dashOnLastYear = true } = {}) => {
    const series = [];
    const colors = [];
    const widths = [];
    const dashArray = [];
    metrics.forEach((key) => {
      const def = EFFECT_METRICS[key];
      series.push({
        name: `${def.label} ${NOW_YEAR}`,
        data: MONTHS.map((m) => toNum((byYear[NOW_YEAR].get(m) || {})[def.field])),
      });
      series.push({
        name: `${def.label} ${LAST_YEAR}`,
        data: MONTHS.map((m) => toNum((byYear[LAST_YEAR].get(m) || {})[def.field])),
      });
      colors.push(def.color, def.lastColor);
      widths.push(3, 1.6);
      dashArray.push(0, dashOnLastYear ? 6 : 0);
    });
    return { series, colors, widths, dashArray };
  };

  const hasAny = (rows || []).length > 0;
  if (!hasAny) return null;

  /* 今年已入库的最后一个月（x 轴固定 12 个月，今年后面的月份是空的） */
  const nowUpTo = MONTHS.filter((m) => byYear[NOW_YEAR].has(m)).pop();

  return {
    categories: MONTHS.map((m) => `${Number(m)}月`),
    names: { now: NOW_YEAR, last: LAST_YEAR },
    nowUpTo: nowUpTo ? `${Number(nowUpTo)}月` : '',
    chart1: seriesOf(['ctr', 'cvr', 'ctcvr']),
    chart2: seriesOf(['innerCpa', 'outerCpa']),
  };
}

/** 每组每月的合计（null 不参与求和；整月全空返回 null） */
function buildGroupTotals(series) {
  const months = series[0]?.data.length || 0;
  const totals = {};
  GROUPS.forEach((group) => {
    totals[group] = Array.from({ length: months }, (_, j) => {
      let sum = 0;
      let has = false;
      series.forEach((s) => {
        if (s.group !== group) return;
        const v = s.data[j];
        if (v == null) return;
        sum += v;
        has = true;
      });
      return has ? sum : null;
    });
  });
  return totals;
}

/**
 * 柱顶合计注记：ApexCharts 6.5 原生的 plotOptions.bar.dataLabels.total 是把所有
 * series 加在一起（资源+流量）且每月只画一处；而分段数据标签在柱段过矮（如 ADN、
 * PC模拟器这类小项）时会被直接丢弃。所以合计改用 annotations.points 自己画：
 * 每条注记定位到「该月该组柱顶」，横向偏移由实测 gridWidth 推出来（与 BarChart 的
 * columnWidth 60% 对应），窗口缩放时按新的 gridWidth 重算。
 */
function buildTotalAnnotations(chartCtx, categories, groupTotals) {
  const gl = chartCtx?.w?.globals;
  const gridWidth = gl?.gridWidth;
  if (!gridWidth || !categories?.length || !groupTotals) return [];
  const categoryWidth = gridWidth / categories.length;
  const groupBarWidth = (categoryWidth * COLUMN_WIDTH) / GROUPS.length;
  /* 数值 → 纵向像素位置，用于判断同月两个合计标签会不会撞在一起 */
  const yToPx = (v) =>
    gl.gridHeight - ((v - gl.minY) / (gl.maxY - gl.minY || 1)) * gl.gridHeight;
  const placed = categories.map(() => []); // placed[月份] = [{ px }]
  const points = [];
  GROUPS.forEach((group, gi) => {
    const offsetX = (gi - (GROUPS.length - 1) / 2) * groupBarWidth;
    (groupTotals[group] || []).forEach((total, j) => {
      if (total == null) return;
      const px = yToPx(total);
      /* 同月已有标签且纵向相差不足 14px → 这根柱的标签上抬一格，避免数字叠字 */
      let offsetY = -11;
      if (placed[j].some((p) => Math.abs(p.px - px) < 14)) offsetY -= 13;
      placed[j].push({ px });
      points.push({
        x: categories[j],
        y: total,
        marker: { size: 0 },
        label: {
          text: formatTotal(total),
          borderWidth: 0,
          offsetX,
          offsetY,
          style: {
            background: 'transparent',
            color: '#343a40',
            fontSize: '10px',
            fontWeight: 700,
          },
        },
      });
    });
  });
  return points;
}

/** 柱顶合计文案：不加千分位，避免与相邻那根柱的标签连成一片 */
function formatTotal(total) {
  return Number.isInteger(total) ? String(total) : total.toFixed(1);
}

export default function TapRepMonthly() {
  const summaryQuery = useChartData(
    'taprep-monthly-summary',
    () => querySqlV09(SUMMARY_SQL),
    {},
    { transform: transformSummary }
  );

  const effectQuery = useChartData(
    'taprep-monthly-ad-effect',
    () => querySqlV09(EFFECT_SQL),
    {},
    { transform: transformEffect }
  );

  const chart = summaryQuery.data;
  const effect = effectQuery.data;
  const appliedAnnotationsRef = useRef('');

  /** 柱顶合计注记：图表 mounted/updated/resized 时按当前几何重画，值没变就跳过 */
  const syncTotalAnnotations = (chartCtx) => {
    if (!chartCtx || !chart) return;
    const points = buildTotalAnnotations(chartCtx, chart.categories, chart.groupTotals);
    if (!points.length) return;
    const signature = JSON.stringify(points.map((p) => [p.x, p.y, p.label.offsetX]));
    if (appliedAnnotationsRef.current === signature) return;
    appliedAnnotationsRef.current = signature;
    chartCtx.updateOptions({ annotations: { points } }, false, false);
  };

  /** 某几个指标对应的 series 名称（今年 + 去年），用于把 series 映射到左/右 Y 轴 */
  const axisNames = (metrics) =>
    metrics.flatMap((k) => [
      `${EFFECT_METRICS[k].label} ${NOW_YEAR}`,
      `${EFFECT_METRICS[k].label} ${LAST_YEAR}`,
    ]);

  const span = chart?.months?.length
    ? `${chart.months[0]} ~ ${chart.months[chart.months.length - 1]}`
    : '';

  return (
    <div className="container-fluid p-4">
      <h2 className="fw-bold mb-4">
        <i className="bi bi-calendar3 text-primary me-2"></i>
        TapREP 月报
      </h2>

      <div id="taprep-monthly-content">
        {/* 资源发放 / 流量消耗：分组堆叠柱（每月两根柱子并排，各自堆叠） */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-white border-0">
            <div className="fw-semibold">资源发放与流量消耗 — 最近15个月</div>
            <div className="text-muted small mt-1">
              数据表 {TABLE}
              {span && <> · 时间范围 {span}</>}
              {' '}· 金额单位:万元
              <br />
              每月两根柱：左=资源发放(6 项堆叠)，右=流量消耗(2 项堆叠)；空白月份表示该月无此数据
            </div>
          </div>
          <div className="card-body">
            <BarChart
              series={chart?.series || []}
              loading={summaryQuery.isLoading}
              error={summaryQuery.error?.message}
              height={650}
              stacked
              shared
              events={{
                mounted: syncTotalAnnotations,
                updated: syncTotalAnnotations,
                resized: syncTotalAnnotations,
              }}
              colors={SERIES_COLORS}
              xaxisOverrides={{
                categories: chart?.categories || [],
                labels: { rotate: -45 },
              }}
              yaxisOverrides={{
                title: { text: '金额(万元)' },
                labels: { formatter: (v) => formatCompactNumber(v) },
              }}
              legendOverrides={{
                position: 'top',
                horizontalAlign: 'left',
                fontSize: '12px',
                clusterGroupedSeries: true,
                clusterGroupedSeriesOrientation: 'horizontal',
              }}
            />
          </div>
        </div>

        {/* 广告效果：今年 vs 去年，两图并排 + 联动（chart.group） */}
        <div className="row g-3 mb-4">
          <div className="col-12 col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0">
                <div className="fw-semibold">广告效果转化率 CTR / CVR / CTCVR — {LAST_YEAR} vs {NOW_YEAR}</div>
                <div className="text-muted small mt-1">
                  数据表 {TABLE} · x 轴为自然月
                  <br />
                  左轴 CTR、CVR(%)，右轴 CTCVR(%)；实线加粗={NOW_YEAR}，虚线={LAST_YEAR}
                  {effect?.nowUpTo && <>（{NOW_YEAR} 已入库至 {effect.nowUpTo}）</>} · 两图缩放/悬浮联动
                </div>
              </div>
              <div className="card-body">
                <LineChart
                  series={effect?.chart1.series || []}
                  loading={effectQuery.isLoading}
                  error={effectQuery.error?.message}
                  height={380}
                  colors={effect?.chart1.colors}
                  strokeWidth={effect?.chart1.widths}
                  strokeDashArray={effect?.chart1.dashArray}
                  markers={3}
                  shared
                  chartGroup={EFFECT_GROUP}
                  xaxisOverrides={{
                    type: 'category',
                    categories: effect?.categories || [],
                    labels: { rotate: 0 },
                  }}
                  yaxisOverrides={{
                    seriesName: axisNames(['ctr', 'cvr']),
                    title: { text: 'CTR / CVR (%)' },
                    labels: { formatter: (v) => `${v}%` },
                  }}
                  yaxisRight={{
                    seriesName: axisNames(['ctcvr']),
                    title: { text: 'CTCVR (%)' },
                    labels: { formatter: (v) => `${v}%` },
                  }}
                  legendOverrides={{
                    /* 放到底部：顶部左侧图例会被右上角工具栏压住 */
                    position: 'bottom',
                    horizontalAlign: 'center',
                    fontSize: '11px',
                    itemMargin: { horizontal: 6, vertical: 2 },
                    /* 双轴时默认图例按 Y 轴分列，关掉后按 series 顺序排一行 */
                    clusterGroupedSeries: false,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="col-12 col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0">
                <div className="fw-semibold">计划综合 CPA — {LAST_YEAR} vs {NOW_YEAR}</div>
                <div className="text-muted small mt-1">
                  数据表 {TABLE} · x 轴为自然月
                  <br />
                  实线加粗={NOW_YEAR}，虚线={LAST_YEAR}
                  {effect?.nowUpTo && <>（{NOW_YEAR} 已入库至 {effect.nowUpTo}）</>} · 与左侧图缩放/悬浮联动
                </div>
              </div>
              <div className="card-body">
                <LineChart
                  series={effect?.chart2.series || []}
                  loading={effectQuery.isLoading}
                  error={effectQuery.error?.message}
                  height={380}
                  colors={effect?.chart2.colors}
                  strokeWidth={effect?.chart2.widths}
                  strokeDashArray={effect?.chart2.dashArray}
                  markers={3}
                  shared
                  chartGroup={EFFECT_GROUP}
                  xaxisOverrides={{
                    type: 'category',
                    categories: effect?.categories || [],
                    labels: { rotate: 0 },
                  }}
                  yaxisOverrides={{
                    title: { text: 'CPA' },
                  }}
                  legendOverrides={{
                    position: 'bottom',
                    horizontalAlign: 'center',
                    fontSize: '11px',
                    itemMargin: { horizontal: 6, vertical: 2 },
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 纯视觉分割线：无业务含义、不读数据，只在广告效果转化率图下方划一条虚线并居中标注 Benchmark */}
        <div className="d-flex align-items-center gap-3 mt-4 mb-2">
          <span className="flex-grow-1" style={{ borderTop: '2px dashed #ced4da' }} />
          <span className="text-muted fw-semibold" style={{ fontSize: '12px', letterSpacing: '0.12em' }}>
            Benchmark
          </span>
          <span className="flex-grow-1" style={{ borderTop: '2px dashed #ced4da' }} />
        </div>

        {/* 分割线下方：广告 Benchmark + 标签 Benchmark（三级维度联动 + low/median/high 区间带） */}
        <BenchmarkSection title="广告 Benchmark" table="taptap_rep_ad_benchmark_monthly" dims={AD_BENCH_DIMS} />
        <BenchmarkSection title="标签 Benchmark" table="taptap_rep_tag_benchmark_monthly" dims={TAG_BENCH_DIMS} />
      </div>
    </div>
  );
}
