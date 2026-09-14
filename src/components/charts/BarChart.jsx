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
  /** 是否在堆叠柱顶部显示总数 */
  totalLabels = false,
  /** 自定义 xaxis 覆盖 */
  xaxisOverrides = {},
  /** 自定义 yaxis 覆盖 */
  yaxisOverrides = {},
  /** 自定义图例覆盖 */
  legendOverrides = {},
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
          ...(totalLabels
            ? {
                total: {
                  enabled: true,
                  style: {
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#495057',
                  },
                  formatter: (val) => {
                    if (val == null || isNaN(val)) return '';
                    if (Math.abs(val) >= 1e8) return (val / 1e8).toFixed(1) + '亿';
                    if (Math.abs(val) >= 1e4) return (val / 1e4).toFixed(1) + '万';
                    return String(val);
                  },
                },
              }
            : {}),
        },
      },
    },
    xaxis: {
      ...xaxisOverrides,
    },
    yaxis: {
      ...yaxisOverrides,
    },
    legend: {
      ...legendOverrides,
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