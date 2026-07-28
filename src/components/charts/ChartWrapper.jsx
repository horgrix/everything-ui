import Chart from 'react-apexcharts';
import { baseChartOptions } from '../../utils/chart-theme';
import Loading from '../common/Loading';

/**
 * ApexCharts 通用包装组件
 * @param {Object} options - ApexCharts options（会与 baseChartOptions 合并）
 * @param {Array} series - ApexCharts series 数据
 * @param {string} type - 图表类型: line/bar/area/pie/donut/radialBar/heatmap/candlestick 等
 * @param {number} height - 图表高度
 * @param {boolean} loading - 加载状态
 * @param {string} error - 错误信息
 */
export default function ChartWrapper({
  options = {},
  series = [],
  type = 'line',
  height = 350,
  loading = false,
  error = null,
  /** ApexCharts 事件回调 */
  events = {},
}) {
  if (loading) return <Loading />;

  if (error) {
    return (
      <div className="alert alert-warning text-center" role="alert">
        <i className="bi bi-exclamation-triangle me-2"></i>
        {error}
      </div>
    );
  }

  // 深度合并 options（events 通过 chart prop 传入）
  const mergedOptions = deepMerge(baseChartOptions, options);
  if (Object.keys(events).length > 0) {
    mergedOptions.chart = mergedOptions.chart || {};
    mergedOptions.chart.events = events;
  }

  return (
    <Chart
      options={mergedOptions}
      series={series}
      type={type}
      height={height}
    />
  );
}

/** 简单的深度合并（仅合并一层嵌套） */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = { ...target[key], ...source[key] };
    } else {
      result[key] = source[key];
    }
  }
  return result;
}