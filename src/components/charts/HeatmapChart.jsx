import ChartWrapper from './ChartWrapper';

/**
 * 热力图组件
 * 适用于：相关性矩阵、密度分布
 * series 数据格式: [{ name: '行标签', data: [{ x: '列标签', y: 值 }, ...] }]
 */
export default function HeatmapChart({
  series = [],
  height = 400,
  loading = false,
  error = null,
  /** 自定义 colorScale ranges */
  colorScale = null,
  /** dataLabel 格式化函数 */
  valueFormatter = (val) => val?.toFixed(2) ?? '',
  /** 自定义 xaxis 覆盖 */
  xaxisOverrides = {},
}) {
  const defaultRanges = [{ from: -1, to: 1, color: undefined }];
  const options = {
    chart: {
      type: 'heatmap',
      toolbar: { show: false },
    },
    plotOptions: { 
      heatmap: {
        shadeIntensity: 0.5,
        colorScale: {
          ranges: colorScale || defaultRanges,
        },
        enableShades: false,
        radius: 0,
      },
    },
    dataLabels: {
      enabled: true,
      style: {
        fontSize: '12px',
        fontWeight: 'bold',
        colors: ['#ffffff'],
      },
      formatter: (val) => (val != null ? valueFormatter(val) : ''),
    },
    xaxis: {
      type: 'category',
      labels: {
        rotate: -45,
        style: { fontSize: '11px' },
      },
      ...xaxisOverrides,
    },
    yaxis: {
      reversed: false,
    },
    tooltip: {
      y: {
        formatter: (val) => val?.toFixed(4) ?? '',
      },
    },
    grid: {
      padding: { right: 20 },
    },
  };

  return (
    <ChartWrapper
      options={options}
      series={series}
      type="heatmap"
      height={height}
      loading={loading}
      error={error}
    />
  );
}