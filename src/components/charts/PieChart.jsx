import ChartWrapper from './ChartWrapper';
import { formatNumber } from '../../utils/formatters';

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
  /** 环形图中心总数的文字标签 */
  totalLabel = '',
  /** 显式总数（覆盖自动求和），如总游戏数 */
  totalValue = null,
  /** 图例位置 */
  legendPosition = 'bottom',
  /** 图例覆盖配置（horizontalAlign 等） */
  legendOverrides = {},
  /** 数据标签偏移（正值向外，标签显示在圈外） */
  dataLabelsOffset = 0,
  /** 是否显示工具栏 */
  toolbar = true,
  /** 显示标签的最小扇区角度（0 表示全显示） */
  minAngleToShowLabel = 10,
  /** 使用外部标签（external data labels） */
  externalLabels = false,
  /** 仅显示百分比（不显示标签名） */
  percentOnly = false,
  /** 自定义切片颜色（按 series 顺序） */
  colors = null,
  /** 点击切片回调：({ seriesIndex, label, value }) => void */
  onDataClick = null,
  /** 每个切片的描边颜色（用于标出「已选中」的扇区） */
  sliceStrokeColors = null,
  /** 切片描边宽度 */
  sliceStrokeWidth = 1,
}) {
  const type = donut ? 'donut' : 'pie';

  const options = {
    chart: {
      type,
      width: '100%',
      toolbar: { show: toolbar },
      ...(onDataClick
        ? {
            events: {
              dataPointSelection: (event, chartContext, config) => {
                const index = config?.dataPointIndex;
                if (index == null || index < 0) return;
                onDataClick({
                  seriesIndex: index,
                  label: labels[index],
                  value: series[index],
                });
              },
            },
          }
        : {}),
    },
    labels,
    ...(colors ? { colors } : {}),
    ...(sliceStrokeColors ? { stroke: { width: sliceStrokeWidth, colors: sliceStrokeColors } } : {}),
    legend: {
      show: showLegend,
      position: legendPosition,
      ...legendOverrides,
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
                  ...(totalLabel ? { label: totalLabel } : {}),
                  ...(totalValue != null ? { formatter: () => formatNumber(totalValue) } : {}),
                  fontSize: '16px',
                  fontWeight: 600,
                },
              },
            }
          : {},
        ...(externalLabels ? { dataLabels: { external: { show: true } } } : {}),
      },
    },
    dataLabels: {
      enabled: true,
      offset: dataLabelsOffset,
      minAngleToShowLabel,
      formatter: (val, opts) => {
        if (percentOnly) return val.toFixed(1) + '%';
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
          legend: { position: 'bottom' },
        },
      },
    ],
  };

  const isEmpty = !series || series.length === 0;

  return (
    <ChartWrapper
      key={JSON.stringify({ series, labels })}
      options={options}
      series={series}
      type={type}
      height={height}
      loading={loading || isEmpty}
      error={error}
    />
  );
}