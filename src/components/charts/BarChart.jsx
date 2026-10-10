import ChartWrapper from './ChartWrapper';

/**
 * 柱状图组件
 * 适用于：分类对比、瀑布图（需外部处理 series data）、分组堆叠（series 带 group）
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
  /** 悬浮提示是否一起显示所有 series */
  shared = false,
  /** 自定义 xaxis 覆盖 */
  xaxisOverrides = {},
  /** 自定义 yaxis 覆盖（左轴） */
  yaxisOverrides = {},
  /** 自定义右轴配置，有值则启用双 Y 轴 */
  yaxisRight = {},
  /** yaxis annotations 数组：{ y, color, position, label, dash } */
  annotations = null,
  /** 自定义图例覆盖 */
  legendOverrides = {},
  /** 自定义颜色数组 */
  colors = null,
  /** 是否显示每个柱段的数据标签 */
  dataLabelsEnabled = false,
  /** 是否显示工具栏 */
  toolbar = true,
  /** 柱体填充配置（如 { opacity: 1 }） */
  fill = null,
  /** 堆叠总数标签格式化函数 (val, opts) => string */
  totalLabelFormatter = null,
}) {
  const hasRightAxis = Object.keys(yaxisRight).length > 0;

  const options = {
    chart: {
      type: 'bar',
      stacked,
      toolbar: { show: toolbar },
    },
    ...(colors ? { colors } : {}),
    ...(fill ? { fill } : {}),
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
                  formatter: totalLabelFormatter
                    ? totalLabelFormatter
                    : (val) => {
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
      type: 'category',
      ...xaxisOverrides,
    },
    yaxis: hasRightAxis
      ? [
          { ...yaxisOverrides },
          { opposite: true, ...yaxisRight },
        ]
      : { ...yaxisOverrides },
    legend: {
      ...legendOverrides,
    },
    tooltip: { shared, intersect: !shared },
    dataLabels: {
      enabled: dataLabelsEnabled,
    },
    ...(annotations && annotations.length
      ? {
          annotations: {
            yaxis: annotations.map((a) => ({
              y: a.y,
              borderColor: a.color || '#e71d36',
              strokeDashArray: a.dash || 3,
              label: {
                text: a.label || '',
                position: a.position || 'right',
                style: { color: '#333', fontSize: '12px' },
              },
            })),
          },
        }
      : {}),
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