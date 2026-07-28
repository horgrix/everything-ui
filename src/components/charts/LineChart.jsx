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
  markers = 0,
  colors = null,
  yaxisAnnotations = null,
  chartGroup = null,
  /** 传递给 ChartWrapper 的额外 events */
  chartEvents = {},
}) {
  const curve = stepline ? 'stepline' : 'smooth';
  const type = area ? 'area' : 'line';

  const options = {
    chart: {
      type,
      stacked,
      zoom: { enabled: true },
      ...(chartGroup ? { group: chartGroup } : {}),
    },
    ...(colors ? { colors } : {}),
    stroke: { curve, width: strokeWidth },
    markers: { size: markers, hover: { size: markers + 2 || 5 } },
    fill: area ? { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.05 } } : {},
    dataLabels: { enabled: showLabels },
    tooltip: { shared: false, intersect: false },
    xaxis: { ...datetimeAxis, ...xaxisOverrides },
    yaxis: { ...(currency ? { labels: { formatter: currencyFormatter } } : {}), ...yaxisOverrides },
    ...(yaxisAnnotations ? {
      annotations: {
        yaxis: yaxisAnnotations.map((a) => ({
          y: a.y, borderColor: a.color || '#e71d36', strokeDashArray: a.dash || 3,
          label: { text: a.label || '', style: { color: '#333', fontSize: '12px' } },
        })),
      },
    } : {}),
  };

  return (
    <ChartWrapper options={options} series={series} type={type} height={height} loading={loading} error={error} events={chartEvents} />
  );
}