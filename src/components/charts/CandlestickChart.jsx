import ChartWrapper from './ChartWrapper';
import { datetimeAxis, currencyFormatter } from '../../utils/chart-theme';

/**
 * K线 / 蜡烛图组件
 * series 数据格式: [{ data: [{ x: Date, y: [O, H, L, C] }, ...] }]
 */
export default function CandlestickChart({
  series = [],
  height = 400,
  loading = false,
  error = null,
  /** 是否同时显示成交量柱状图 */
  showVolume = false,
  /** ApexCharts 标注对象 */
  annotations = null,
  /** 同步组名，同一 group 的图表共享 tooltip */
  chartGroup = null,
  /** 传递给 ChartWrapper 的额外 events */
  chartEvents = {},
}) {
  const options = {
    chart: {
      type: 'candlestick',
      toolbar: { show: true },
      ...(chartGroup ? { group: chartGroup } : {}),
    },
    ...(annotations ? { annotations } : {}),
    xaxis: {
      ...datetimeAxis,
      type: 'datetime',
    },
    yaxis: {
      tooltip: { enabled: true },
      labels: {
        formatter: currencyFormatter,
      },
    },
    plotOptions: {
      candlestick: {
        colors: {
          upward: '#2ec4b6',
          downward: '#e71d36',
        },
        wick: {
          useFillColor: true,
        },
      },
    },
  };

  return (
    <ChartWrapper
      options={options}
      series={series}
      type="candlestick"
      height={height}
      loading={loading}
      error={error}
      events={chartEvents}
    />
  );
}