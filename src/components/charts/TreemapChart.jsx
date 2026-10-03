import ChartWrapper from './ChartWrapper';

/**
 * 矩形树图（Treemap）
 * 适用于：占比分布、层级展示、Drilldown 下钻
 */
export default function TreemapChart({
  series = [],
  height = 350,
  loading = false,
  error = null,
  /** 颜色区间 [{ from, to, color }] */
  colorRanges = null,
  /** 各块独立颜色（配合 distributed 使用） */
  colors = null,
  /** 每个数据块按顺序独立取色 */
  distributed = false,
  /** ApexCharts Drilldown 下钻配置 */
  drilldown = null,
  /** dataLabel 格式化函数（如百分比展示） */
  dataLabelsFormatter = null,
}) {
  const options = {
    chart: {
      type: 'treemap',
    },
    ...(colors ? { colors } : {}),
    plotOptions: {
      treemap: {
        enableShades: false,
        distributed,
        ...(colorRanges ? { colorScale: { ranges: colorRanges } } : {}),
      },
    },
    dataLabels: {
      enabled: true,
      style: {
        fontSize: '12px',
        colors: ['#fff'],
      },
      ...(dataLabelsFormatter ? { formatter: dataLabelsFormatter } : {}),
    },
    ...(drilldown ? { drilldown } : {}),
  };

  return (
    <ChartWrapper options={options} series={series} type="treemap" height={height} loading={loading} error={error} />
  );
}
