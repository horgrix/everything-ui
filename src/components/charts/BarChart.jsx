import ChartWrapper from './ChartWrapper';

/**
 * 柱状图组件
 * 适用于：分类对比、瀑布图（需外部处理 series data）
 */
export default function BarChart({
  series = [],
  height = 350,
  loading = false,
  error = null,
  /** 是否横向 */
  horizontal = false,
  /** 是否堆叠 */
  stacked = false,
  /** 自定义 xaxis 覆盖 */
  xaxisOverrides = {},
  /** 自定义 yaxis 覆盖 */
  yaxisOverrides = {},
}) {
  const options = {
    chart: {
      type: 'bar',
      stacked,
    },
    plotOptions: {
      bar: {
        horizontal,
        borderRadius: 4,
        columnWidth: horizontal ? '70%' : '60%',
        dataLabels: {
          position: horizontal ? 'center' : 'top',
        },
      },
    },
    xaxis: {
      ...xaxisOverrides,
    },
    yaxis: {
      ...yaxisOverrides,
    },
    dataLabels: {
      enabled: false,
    },
  };

  return (
    <ChartWrapper
      options={options}
      series={series}
      type="bar"
      height={height}
      loading={loading}
      error={error}
    />
  );
}