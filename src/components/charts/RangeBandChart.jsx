import ChartWrapper from './ChartWrapper';

/**
 * 区间带 + 中线组合图
 *
 * series 里每项自带 type：`rangeArea` 画 low~high 的浅色区间带，`line` 画 median 中线。
 * ApexCharts 在 chart.type='rangeArea' 时按 combo 模式逐 series 绘制，故可混排。
 *
 * @param {Array} series - [{ name, type: 'rangeArea' | 'line', data }]
 *        rangeArea 的 data 元素为 [low, high]，line 为数值；缺数据用 null 留空
 * @param {Array} colors - 每个 series 的颜色
 * @param {Array} strokeWidth - 每个 series 的线宽（区间带填 0 即无边框）
 * @param {Array} strokeDashArray - 每个 series 的虚线样式（0 为实线）
 * @param {Array} fillOpacity - 每个 series 的填充透明度
 * @param {Array} markers - 每个 series 的标记点大小
 */
export default function RangeBandChart({
  series = [],
  height = 380,
  loading = false,
  error = null,
  colors = null,
  strokeWidth = null,
  strokeDashArray = null,
  fillOpacity = null,
  markers = null,
  xMin = 1,
  xMax = null,
  yAxisTitle = '',
  yFormatter = null,
  legendOverrides = {},
}) {
  const options = {
    chart: {
      type: 'rangeArea',
      zoom: { enabled: false },
      toolbar: { show: true },
    },
    ...(colors ? { colors } : {}),
    stroke: {
      curve: 'straight',
      ...(strokeWidth ? { width: strokeWidth } : {}),
      ...(strokeDashArray ? { dashArray: strokeDashArray } : {}),
    },
    ...(markers ? { markers: { size: markers, hover: { size: 5 } } } : {}),
    ...(fillOpacity ? { fill: { type: 'solid', opacity: fillOpacity } } : {}),
    dataLabels: { enabled: false },
    legend: { ...legendOverrides },
    /* 注：ApexCharts v6 对 rangeArea 系列用内置 rangebar 版 tooltip，tooltip.custom 不生效，
       所以这里只做基础配置（悬停显示该系列的月份与值） */
    tooltip: { shared: false, intersect: false },
    xaxis: xMax
      ? {
          /* 数值轴：每个点是 { x: 月份序号, y }，两年点位按月份对齐（缺月自然留白） */
          type: 'numeric',
          min: xMin,
          max: xMax,
          tickAmount: xMax - 1,
          labels: {
            rotate: 0,
            formatter: (v) => (Number.isFinite(Number(v)) ? `${Math.round(Number(v))}月` : ''),
          },
        }
      : { type: 'category', labels: { rotate: 0 } },
    yaxis: {
      ...(yAxisTitle ? { title: { text: yAxisTitle } } : {}),
      ...(yFormatter ? { labels: { formatter: yFormatter } } : {}),
    },
  };

  return (
    <ChartWrapper
      options={options}
      series={series}
      type="rangeArea"
      height={height}
      loading={loading}
      error={error}
    />
  );
}
