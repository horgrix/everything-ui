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
  /** y 轴是否反转（true：第一个 series 显示在顶部，从上到下自然阅读顺序） */
  yaxisReversed = false,
  /**
   * 无值(null)格子的填充色（如 '#ffffff'）。
   * ApexCharts 热力图对 null 不匹配任何色阶，会回退成默认系列色；
   * 传入此色后，未命中 colorScale 的格子统一显示为该色。
   */
  noDataColor = null,
  /** 自定义 tooltip：传入后覆盖默认 tooltip（ApexCharts custom 形式，返回 HTML 字符串） */
  tooltipCustom = null,
}) {
  const defaultRanges = [{ from: -1, to: 1, color: undefined }];
  const options = {
    // 未命中色阶的格子（无值/null）回退到该色：ApexCharts 会把 chart.colors 自动补齐到系列数
    ...(noDataColor ? { colors: [noDataColor] } : {}),
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
      reversed: yaxisReversed,
    },
    tooltip: tooltipCustom
      ? { custom: tooltipCustom }
      : {
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