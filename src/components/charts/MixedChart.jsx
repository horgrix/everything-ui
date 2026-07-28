import ChartWrapper from './ChartWrapper';
import { datetimeAxis, currencyFormatter } from '../../utils/chart-theme';

/**
 * 混合图表（折线+柱状 双Y轴）
 * 适用于：预算vs实际、量价关系
 * series 中需指定 type: 'line' | 'column' | 'bar' | 'area'
 */
export default function MixedChart({
  series = [],
  height = 350,
  loading = false,
  error = null,
  /** Y轴配置：第一个Y轴（左）和第二个Y轴（右） */
  yaxisLeft = {},
  yaxisRight = {},
  xaxisOverrides = {},
  /** 自定义颜色数组 */
  colors = null,
  /** 自定义线条宽度数组 */
  strokeWidths = null,
  /** tooltip Y 值格式化函数，根据 yAxisIndex 返回字符串 */
  tooltipY = null,
}) {
  const options = {
    chart: {
      type: 'line',
      stacked: false,
    },
    ...(colors ? { colors } : {}),
    stroke: {
      width: strokeWidths || [0, 2, 2],
    },
    plotOptions: {
      bar: {
        columnWidth: '50%',
      },
    },
    fill: {
      opacity: [1, 0.25, 1],
    },
    xaxis: {
      ...datetimeAxis,
      ...xaxisOverrides,
    },
    yaxis: [
      {
        ...yaxisLeft,
        labels: {
          formatter: yaxisLeft?.labels?.formatter || yaxisLeft?.formatter || ((val) => val),
          ...(yaxisLeft?.labels || {}),
        },
      },
      {
        opposite: true,
        ...yaxisRight,
        labels: {
          formatter: yaxisRight?.labels?.formatter || yaxisRight?.formatter || ((val) => val),
          ...(yaxisRight?.labels || {}),
        },
      },
    ],
    tooltip: {
      shared: true,
      intersect: false,
      ...(tooltipY
        ? {
            y: {
              formatter: function (val, { seriesIndex, w }) {
                const si = seriesIndex !== undefined ? seriesIndex : 0;
                const seriesConf = w.config.series[si] || {};
                const yAxisIdx = seriesConf.yAxisIndex !== undefined ? seriesConf.yAxisIndex : 0;
                return tooltipY(val, yAxisIdx);
              },
            },
          }
        : {
            y: {
              formatter: function (val, { seriesIndex, w }) {
                const si = seriesIndex !== undefined ? seriesIndex : 0;
                const seriesConf = w.config.series[si] || {};
                const yAxisIdx = seriesConf.yAxisIndex !== undefined ? seriesConf.yAxisIndex : 0;
                if (yAxisIdx === 1) {
                  return val.toFixed(1) + '%';
                }
                return Math.round(val);
              },
            },
          }),
    },
  };

  return (
    <ChartWrapper
      options={options}
      series={series}
      type="line"
      height={height}
      loading={loading}
      error={error}
    />
  );
}