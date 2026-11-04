import ChartWrapper from './ChartWrapper';

/**
 * 区间带 + 中线组合图
 *
 * series 里每项自带 type：`rangeArea` 画 low~high 的浅色区间带，`line` 画 median 中线。
 * ApexCharts 在 chart.type='rangeArea' 时按 combo 模式逐 series 绘制，故可混排。
 *
 * @param {Array} series - [{ name, type: 'rangeArea' | 'line', data }]
 *        rangeArea 的 data 元素为 [low, high]，line 为数值；缺数据用 null 留空
 * @param {Array} colors - 每个 series 的颜色
 * @param {Array} strokeWidth - 每个 series 的线宽（区间带填 0 即无边框）
 * @param {Array} strokeDashArray - 每个 series 的虚线样式（0 为实线）
 * @param {Array} fillOpacity - 每个 series 的填充透明度
 * @param {Array} markers - 每个 series 的标记点大小
 */
export default function RangeBandChart({
  series = [],
  height = 380,
  loading = false,
  error = null,
  colors = null,
  strokeWidth = null,
  strokeDashArray = null,
  fillOpacity = null,
  markers = null,
  xMin = 1,
  xMax = null,
  yAxisTitle = '',
  yFormatter = null,
  legendOverrides = {},
  /** 悬停时是否把所有系列在该 x 上的值一起显示（默认开） */
  sharedTooltip = true,
}) {
  const options = {
    chart: {
      type: 'rangeArea',
      zoom: { enabled: false },
      toolbar: { show: true },
    },
    ...(colors ? { colors } : {}),
    stroke: {
      curve: 'straight',
      ...(strokeWidth ? { width: strokeWidth } : {}),
      ...(strokeDashArray ? { dashArray: strokeDashArray } : {}),
    },
    ...(markers ? { markers: { size: markers, hover: { size: 5 } } } : {}),
    ...(fillOpacity ? { fill: { type: 'solid', opacity: fillOpacity } } : {}),
    dataLabels: { enabled: false },
    legend: { ...legendOverrides },
    /* 注：ApexCharts v6 对 rangeArea 系列用内置 rangebar 版 tooltip，tooltip.custom 不生效，
       所以这里用 shared + y.formatter：悬停同一个月份时把所有系列（区间带 + 均值线）一起列出，
       区间带的 y 是 [low, high]，格式化成「下限 ~ 上限」。 */
    tooltip: {
      shared: sharedTooltip,
      intersect: false,
      custom: ({ dataPointIndex, w }) => {
        const fmt = (v) => (v == null || Number.isNaN(Number(v)) ? '-' : yFormatter ? yFormatter(Number(v)) : String(v));
        // 取当前悬停的 x（月份序号）；Apex 对不同 series 的 x 做了对齐，优先用 seriesX
        const seriesX = w?.globals?.seriesX?.[0] || [];
        const hoveredX = seriesX[dataPointIndex] ?? w?.globals?.labels?.[dataPointIndex];
        if (hoveredX == null) return '';
        const monthNum = Number(hoveredX);
        const title = Number.isFinite(monthNum) ? `${Math.round(monthNum)}月` : String(hoveredX);

        const rows = (w?.config?.series || [])
          .map((s, i) => {
            const pt = (s.data || []).find((d) => Number(d.x) === monthNum);
            if (!pt || pt.y == null) return null;
            const value = Array.isArray(pt.y) ? `${fmt(pt.y[0])} ~ ${fmt(pt.y[1])}` : fmt(pt.y);
            const color = (w?.config?.colors || [])[i] || '#999';
            const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px"></span>`;
            return `<div style="display:flex;align-items:center;gap:10px;justify-content:space-between"><span style="display:inline-flex;align-items:center;white-space:nowrap">${dot}${s.name}</span><b style="margin-left:12px;white-space:nowrap">${value}</b></div>`;
          })
          .filter(Boolean);

        if (!rows.length) return '';
        return `<div style="padding:6px 10px;font-size:12px;line-height:1.7;min-width:200px"><div style="opacity:.7;margin-bottom:4px">${title}</div>${rows.join('')}</div>`;
      },
      y: {
        formatter: (val) => {
          const fmt = (v) => (v == null || Number.isNaN(Number(v)) ? '-' : yFormatter ? yFormatter(Number(v)) : String(v));
          if (Array.isArray(val)) return `${fmt(val[0])} ~ ${fmt(val[1])}`;
          return fmt(val);
        },
      },
    },
    xaxis: xMax
      ? {
          /* 数值轴：每个点是 { x: 月份序号, y }，两年点位按月份对齐（缺月自然留白） */
          type: 'numeric',
          min: xMin,
          max: xMax,
          tickAmount: xMax - 1,
          labels: {
            rotate: 0,
            formatter: (v) => (Number.isFinite(Number(v)) ? `${Math.round(Number(v))}月` : ''),
          },
        }
      : { type: 'category', labels: { rotate: 0 } },
    yaxis: {
      ...(yAxisTitle ? { title: { text: yAxisTitle } } : {}),
      ...(yFormatter ? { labels: { formatter: yFormatter } } : {}),
    },
  };

  return (
    <ChartWrapper
      options={options}
      series={series}
      type="rangeArea"
      height={height}
      loading={loading}
      error={error}
    />
  );
}
