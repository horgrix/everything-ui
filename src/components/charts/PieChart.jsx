import ChartWrapper from './ChartWrapper';

/**
 * 饼图 / 环形图组件
 * 适用于：占比分析、分布展示
 */
export default function PieChart({
  series = [],
  labels = [],
  height = 350,
  loading = false,
  error = null,
  /** 是否为环形图 */
  donut = false,
  /** 是否显示图例 */
  showLegend = true,
}) {
  const type = donut ? 'donut' : 'pie';

  const options = {
    chart: {
      type,
    },
    labels,
    legend: {
      show: showLegend,
      position: 'bottom',
    },
    plotOptions: {
      pie: {
        donut: donut
          ? {
              size: '55%',
              labels: {
                show: true,
                total: {
                  show: true,
                  showAlways: true,
                  fontSize: '16px',
                  fontWeight: 600,
                },
              },
            }
          : {},
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val, opts) => {
        return opts.w.config.labels[opts.seriesIndex] + ': ' + val.toFixed(1) + '%';
      },
      style: {
        fontSize: '12px',
      },
    },
    responsive: [
      {
        breakpoint: 480,
        options: {
          chart: { width: 300 },
          legend: { position: 'bottom' },
        },
      },
    ],
  };

  return (
    <ChartWrapper
      options={options}
      series={series}
      type={type}
      height={height}
      loading={loading}
      error={error}
    />
  );
}