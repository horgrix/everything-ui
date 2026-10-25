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
  /** Y轴配置：第一个Y轴（左）和第二个Y轴（右，不传则只渲染左轴） */
  yaxisLeft = {},
  yaxisRight = null,
  xaxisOverrides = {},
  /** 自定义颜色数组 */
  colors = null,
  /** 自定义线条宽度数组 */
  strokeWidths = null,
  /** 自定义虚线样式数组（Apex dashArray，0=实线）；与 strokeWidths 按下标一一对应 */
  strokeDashArray = null,
  /** tooltip X（标题）格式化函数 */
  tooltipX = null,
  /** tooltip Y 值格式化函数，根据 yAxisIndex 返回字符串 */
  tooltipY = null,
  /** 是否显示工具栏，默认 true */
  toolbar = true,
  /** 自定义 fill 覆盖 */
  fill = null,
  /** 自定义 dataLabels 覆盖 */
  dataLabels = null,
  /** 自定义图例覆盖（position / horizontalAlign 等） */
  legend = null,
  /** 自定义 grid 覆盖（padding 等） */
  grid = null,
}) {
  const options = {
    chart: {
      type: 'line',
      stacked: false,
      toolbar: { show: toolbar },
    },
    ...(colors ? { colors } : {}),
    stroke: {
      width: strokeWidths || [0, 2, 2],
      ...(strokeDashArray ? { dashArray: strokeDashArray } : {}),
    },
    plotOptions: {
      bar: {
        columnWidth: '50%',
      },
    },
    fill: fill || { opacity: [1, 0.25, 1] },
    ...(dataLabels ? { dataLabels } : {}),
    ...(legend ? { legend } : {}),
    ...(grid ? { grid } : {}),
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
      ...(yaxisRight
        ? [
            {
              opposite: true,
              ...yaxisRight,
              labels: {
                formatter: yaxisRight?.labels?.formatter || yaxisRight?.formatter || ((val) => val),
                ...(yaxisRight?.labels || {}),
              },
            },
          ]
        : []),
    ],
    tooltip: {
      shared: true,
      intersect: false,
      ...(tooltipX ? { x: { formatter: tooltipX } } : {}),
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