import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { baseChartOptions } from '../../utils/chart-theme';
import Loading from '../common/Loading';

/**
 * ApexCharts（约 219KB gzip）不阻塞首屏：不强塞进入口包。
 * 但也不等到 React 挂载图表才去下载 —— 那会多排一次「页面 chunk 下载完 → 再请求图表库」的串行等待。
 * 这里在模块加载时就发起 import（模块本身属于路由 chunk，自然不会拖慢首帧），
 * 图表库与页面 chunk / 接口数据并行下载，下载完再挂载。
 */
const chartModule = import('react-apexcharts');
const Chart = lazy(() => chartModule);

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
  const apexRef = useRef(null);
  const boxRef = useRef(null);
  // 容器实测宽度：量到之前不创建图表，避免首帧按错误宽度渲染导致整体右偏、与 x 轴错位
  const [boxWidth, setBoxWidth] = useState(0);

  /**
   * ApexCharts 只在 window resize 时重算宽度。
   * 首次渲染时容器宽度可能随后才定下来（页面出现纵向滚动条使可用宽度变窄、flex 重新布局、
   * 中文字体加载改变轴标签宽度等），此时 SVG 仍是旧宽度，图表会整体右偏、与坐标轴对不齐。
   * 这里用 ResizeObserver 监听容器宽度的真实变化并触发 Apex 的重算。
   */
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;

    let lastWidth = Math.round(el.getBoundingClientRect().width);
    let raf = 0;
    const redraw = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const chart = apexRef.current;
        if (chart && typeof chart.windowResizeHandler === 'function') {
          try {
            chart.windowResizeHandler();
          } catch {
            /* 图表已销毁等情况直接忽略 */
          }
        }
      });
    };

    const ro = new ResizeObserver((entries) => {
      const width = Math.round(entries[0]?.contentRect?.width ?? el.getBoundingClientRect().width);
      if (!width) return;
      // 宽度变化时交给 react-apexcharts 以新宽度重建布局（updateOptions），点位与坐标轴才会一起重算
      setBoxWidth((prev) => (prev === width ? prev : width));
      if (Math.abs(width - lastWidth) < 1) return;
      lastWidth = width;
      redraw();
    });
    ro.observe(el);

    // 中文字体加载完成后轴标签宽度会变，需要再量一次
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (boxRef.current) redraw();
      }).catch(() => {});
    }

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  // 深度合并 options（events 通过 chart prop 传入）
  const mergedOptions = deepMerge(baseChartOptions, options);
  if (Object.keys(events).length > 0) {
    mergedOptions.chart = mergedOptions.chart || {};
    mergedOptions.chart.events = events;
  }

  const renderBody = () => {
    if (loading) return <Loading />;
    if (error) {
      return (
        <div className="alert alert-warning text-center" role="alert">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </div>
      );
    }
    if (boxWidth === 0) {
      // 等首帧量到容器宽度再建图（占位撑住高度），避免按错误宽度渲染导致整体右偏、与 x 轴错位
      return <div style={{ height }} aria-hidden="true" />;
    }
    return (
      <Suspense fallback={<div style={{ height }} aria-hidden="true" />}>
        <Chart
          chartRef={apexRef}
          key={JSON.stringify(series)}
          options={mergedOptions}
          series={series}
          type={type}
          height={height}
          width={boxWidth}
        />
      </Suspense>
    );
  };

  // 容器始终渲染：ResizeObserver 需要有真实 DOM 才能量到宽度；
  // width:100% 保证在 flex 居中（align-items:center）的父级里也不会塌成 0 宽
  return (
    <div ref={boxRef} style={{ width: '100%', minWidth: 0 }}>
      {renderBody()}
    </div>
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
