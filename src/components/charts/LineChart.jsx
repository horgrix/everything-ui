import ChartWrapper from './ChartWrapper';
import { datetimeAxis, currencyFormatter } from '../../utils/chart-theme';

export default function LineChart({
  series = [],
  height = 350,
  loading = false,
  error = null,
  area = false,
  stepline = false,
  showLabels = false,
  currency = false,
  stacked = false,
  xaxisOverrides = {},
  yaxisOverrides = {},
  strokeWidth = 2,
  strokeDashArray = null,
  shared = false,
  markers = 0,
  colors = null,
  yaxisAnnotations = null,
  /** 第二（右）Y 轴配置；传入后 yaxis 变为双轴数组 */
  yaxisRight = null,
  chartGroup = null,
  /** 传递给 ChartWrapper 的额外 events */
  chartEvents = {},
  /** 自定义 tooltip（ApexCharts custom 形式，返回 HTML 字符串）；传入后覆盖默认 tooltip */
  tooltipCustom = null,
  /** 是否显示工具栏 */
  toolbar = true,
  /** 图例覆盖配置（position / horizontalAlign 等） */
  legendOverrides = {},
}) {
  const curve = stepline ? 'stepline' : 'smooth';
  const type = area ? 'area' : 'line';

  const options = {
    chart: {
      type,
      stacked,
      zoom: { enabled: true },
      toolbar: { show: toolbar },
      ...(chartGroup ? { group: chartGroup } : {}),
    },
    ...(colors ? { colors } : {}),
    stroke: {
      curve,
      width: strokeWidth,
      ...(strokeDashArray ? { dashArray: strokeDashArray } : {}),
    },
    markers: { size: markers, hover: { size: markers + 2 || 5 } },
    fill: area ? { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.05 } } : {},
    legend: {
      ...legendOverrides,
    },
    dataLabels: { enabled: showLabels },
    tooltip: tooltipCustom
      ? { custom: tooltipCustom, shared: true, intersect: false }
      : { shared, intersect: false },
    xaxis: { ...datetimeAxis, ...xaxisOverrides },
    yaxis: yaxisRight
      ? [
          { ...(currency ? { labels: { formatter: currencyFormatter } } : {}), ...yaxisOverrides },
          { opposite: true, ...yaxisRight },
        ]
      : { ...(currency ? { labels: { formatter: currencyFormatter } } : {}), ...yaxisOverrides },
    ...(yaxisAnnotations ? {
      annotations: {
        yaxis: yaxisAnnotations.map((a) => ({
          y: a.y,
          ...(a.yAxisIndex != null ? { yAxisIndex: a.yAxisIndex } : {}),
          borderColor: a.color || '#e71d36', strokeDashArray: a.dash || 3,
          label: { text: a.label || '', position: a.position || 'right', style: { color: '#333', fontSize: '12px' } },
        })),
      },
    } : {}),
  };

  return (
    <ChartWrapper options={options} series={series} type={type} height={height} loading={loading} error={error} events={chartEvents} />
  );
}