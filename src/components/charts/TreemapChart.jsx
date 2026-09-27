import ChartWrapper from './ChartWrapper';

/**
 * 矩形树图（Treemap）
 * 适用于：占比分布、层级展示
 */
export default function TreemapChart({
  series = [],
  height = 350,
  loading = false,
  error = null,
  /** 颜色区间 [{ from, to, color }] */
  colorRanges = null,
}) {
  const options = {
    chart: {
      type: 'treemap',
    },
    plotOptions: {
      treemap: {
        enableShades: false,
        ...(colorRanges ? { colorScale: { ranges: colorRanges } } : {}),
      },
    },
    dataLabels: {
      enabled: true,
      style: {
        fontSize: '12px',
        colors: ['#fff'],
      },
    },
  };

  return (
    <ChartWrapper options={options} series={series} type="treemap" height={height} loading={loading} error={error} />
  );
}
