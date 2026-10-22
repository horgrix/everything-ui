import ChartWrapper from './ChartWrapper';

/**
 * 带 Brush（范围刷选）的折线图：上方主图 + 下方迷你刷选条。
 *
 * 两个 ApexCharts 实例通过 `chart.id` 与刷选条的 `chart.brush.target` 关联；
 * 拖动下方刷选条即可缩放主图的 x 轴范围。
 * 注意：ApexCharts 的 brush 属于实验性能力，刷选条不影响主图时主图仍可正常展示。
 *
 * @param {Array} series ApexCharts 折线 series（x 建议用毫秒时间戳）
 * @param {number} height 主图高度
 * @param {number} brushHeight 刷选条高度
 * @param {string} id 图表 id 前缀（同页多个实例需不同）
 * @param {{min:number,max:number}|null} brushSelection 刷选条初始选中区间
 */
export default function BrushLineChart({
  series = [],
  height = 380,
  brushHeight = 90,
  colors = null,
  loading = false,
  error = null,
  id = 'brush',
  xaxisOverrides = {},
  yaxisOverrides = {},
  strokeWidth = 2,
  markers = 0,
  tooltipCustom = null,
  legendOverrides = {},
  brushSelection = null,
  categories = null,
}) {
  const mainId = `${id}-main`;
  const brushId = `${id}-brush`;
  // 类别轴下刷选区间是下标（可能是 0），不能用 Number.isFinite 之外的假值判断
  const hasSelection = categories
    ? !!(brushSelection && brushSelection.min != null && brushSelection.max != null)
    : !!(brushSelection && Number.isFinite(brushSelection.min) && Number.isFinite(brushSelection.max));
  // 类别轴：每个数据点一个刻度，专用于日/月级离散数据，避免标签重复
  const axisBase = categories ? { type: 'category', categories } : { type: 'datetime' };

  const mainOptions = {
    chart: {
      id: mainId,
      type: 'line',
      toolbar: { show: false },
    },
    ...(colors ? { colors } : {}),
    stroke: { curve: 'smooth', width: strokeWidth },
    markers: { size: markers, hover: { size: markers + 2 || 4 } },
    dataLabels: { enabled: false },
    xaxis: {
      ...axisBase,
      ...xaxisOverrides,
      // 初始视图即刷选区间（默认最近 N 条）；之后拖动刷选条会由 ApexCharts 覆写 min/max
      ...(hasSelection ? { min: brushSelection.min, max: brushSelection.max } : {}),
    },
    yaxis: { ...yaxisOverrides },
    legend: { ...legendOverrides },
    tooltip: tooltipCustom ? { custom: tooltipCustom } : { shared: true, intersect: false },
  };

  const brushOptions = {
    chart: {
      id: brushId,
      type: 'area',
      brush: { enabled: true, target: mainId, autoScaleYaxis: true },
      ...(hasSelection ? { selection: { enabled: true, xaxis: { min: brushSelection.min, max: brushSelection.max } } } : {}),
      toolbar: { show: false },
    },
    ...(colors ? { colors } : {}),
    stroke: { curve: 'smooth', width: 1 },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
    dataLabels: { enabled: false },
    xaxis: {
      ...axisBase,
      ...xaxisOverrides,
      labels: {
        ...(xaxisOverrides.labels || {}),
        style: { fontSize: '9px' },
      },
    },
    yaxis: { labels: { show: false }, title: { text: undefined } },
    legend: { show: false },
    tooltip: { enabled: false },
  };

  return (
    <div>
      <ChartWrapper options={mainOptions} series={series} type="line" height={height} loading={loading} error={error} />
      <ChartWrapper options={brushOptions} series={series} type="area" height={brushHeight} />
    </div>
  );
}
