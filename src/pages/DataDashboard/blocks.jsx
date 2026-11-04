import { useEffect, useState } from 'react';
import ChartWrapper from '../../components/charts/ChartWrapper';
import { COLORS, baseChartOptions } from '../../utils/chart-theme';
import { formatCompactNumber, formatNumber, formatPercent } from '../../utils/formatters';
import formatCell from './formatCell';

/** KPI 指标卡：一行业绩指标，涨跌用色区分 */
export function KpiBlock({ data }) {
  const items = data?.items ?? [];
  if (!items.length) return <EmptyHint />;

  return (
    <div className="row g-3">
      {items.map((item) => {
        const up = typeof item.delta === 'number' ? item.delta >= 0 : null;
        return (
          <div key={item.label} className="col-6 col-md-4 col-xl">
            <div className="h-100 p-3 rounded-3 bg-body-tertiary border">
              <div className="text-secondary small mb-1 text-truncate" title={item.label}>
                {item.label}
              </div>
              <div className="d-flex align-items-baseline gap-1">
                <span className="fs-3 fw-semibold lh-1">{formatCell(item.value, item.format)}</span>
                {item.unit && <span className="text-secondary small">{item.unit}</span>}
              </div>
              <div className="mt-2 small d-flex align-items-center gap-1">
                {up !== null && (
                  <span className={up ? 'text-success' : 'text-danger'}>
                    <i className={`bi ${up ? 'bi-caret-up-fill' : 'bi-caret-down-fill'} me-1`} />
                    {formatPercent(Math.abs(item.delta), 1)}
                  </span>
                )}
                {item.deltaLabel && <span className="text-secondary">{item.deltaLabel}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 趋势图配色：前两条分别给 PV / UV，保证一眼能分开（chartColors 前两色太接近） */
const TREND_COLORS = ['#4361ee', '#2ec4b6', '#ff9f1c', '#ff006e', '#118ab2', '#7209b7'];

/** 按视口宽度算 x 轴最多显示几个标签（约每 56px 一个），窗口宽度变化自动跟随 */
function useMaxLabels(count) {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 1200 : window.innerWidth));

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const usable = Math.max(220, Math.min(width, 1200) - 120);
  const maxLabels = Math.max(3, Math.floor(usable / 56));
  return Math.max(2, Math.min(count, maxLabels));
}

/** 趋势：折线/柱组合，series 里各自带 type */
export function TrendBlock({ data, height = 320 }) {
  const categories = data?.categories ?? [];
  const tickAmount = useMaxLabels(categories.length);
  const series = data?.series ?? [];
  if (!series.length) return <EmptyHint />;

  const options = {
    chart: { type: 'line', zoom: { enabled: true }, toolbar: { show: false } },
    stroke: { curve: 'smooth', width: 2 },
    markers: { size: 0, hover: { size: 5 } },
    colors: TREND_COLORS,
    dataLabels: { enabled: false },
    grid: { strokeDashArray: 4 },
    legend: { position: 'top', horizontalAlign: 'right' },
    // 稀疏显示：按可用宽度给标签数量上限，窄屏不至于挤成一片
    xaxis: {
      categories,
      tickAmount,
      labels: { rotate: 0, hideOverlappingLabels: true },
    },
    yaxis: { labels: { formatter: (v) => (Math.abs(v) >= 1e4 ? formatCompactNumber(v) : formatNumber(v, 0)) } },
    tooltip: { shared: true, intersect: false, y: { formatter: (v) => formatNumber(v, 0) } },
  };

  return <ChartWrapper type="line" options={{ ...baseChartOptions, ...options }} series={series} height={height} />;
}

/** 榜单 / 明细表 */
export function RankBlock({ data, maxRows }) {
  const columns = data?.columns ?? [];
  const rows = (data?.rows ?? []).slice(0, maxRows || undefined);
  if (!columns.length || !rows.length) return <EmptyHint />;

  return (
    <div className="table-responsive">
      <table className="table table-sm table-hover align-middle mb-0">
        <thead className="table-light">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`text-nowrap small text-secondary fw-normal ${c.align === 'end' ? 'text-end' : ''}`}
                style={c.width ? { width: c.width } : undefined}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? row.key ?? i}>
              {columns.map((c) => {
                const value = row[c.key];
                const negative = c.format === 'percent' && typeof value === 'number' && value < 0;
                return (
                  <td
                    key={c.key}
                    className={`text-nowrap ${c.align === 'end' ? 'text-end' : ''} ${negative ? 'text-danger' : ''} ${c.key === 'rank' ? 'text-secondary' : ''}`}
                  >
                    {formatCell(value, c.format)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 占比分布：环形图 */
export function DistributionBlock({ data, height = 320 }) {
  const labels = data?.labels ?? [];
  const values = data?.values ?? [];
  if (!labels.length) return <EmptyHint />;

  const options = {
    chart: { type: 'donut', toolbar: { show: false } },
    labels,
    colors: COLORS.chartColors,
    dataLabels: { enabled: true, formatter: (v) => `${Number(v).toFixed(1)}%` },
    legend: { position: 'bottom' },
    tooltip: { y: { formatter: (v) => formatNumber(v, 0) } },
    plotOptions: { pie: { donut: { size: '62%' } } },
  };

  return <ChartWrapper type="donut" options={{ ...baseChartOptions, ...options }} series={values} height={height} />;
}

/** 通用明细表（带列定义，无内置排序） */
export function TableBlock({ data, maxRows }) {
  return <RankBlock data={data} maxRows={maxRows} />;
}

export function EmptyHint({ text = '暂无数据' }) {
  return <div className="text-center text-secondary py-5 small">{text}</div>;
}
