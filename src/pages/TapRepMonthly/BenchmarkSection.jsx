import { useMemo, useState } from 'react';
import useChartData from '../../hooks/useChartData';
import { querySqlV09 } from '../../api/query';
import RangeBandChart from '../../components/charts/RangeBandChart';

/**
 * 通用 Benchmark 区块：三级维度联动下拉 + low~high 区间带 + median 均值线（今年实线加粗 / 去年虚线）。
 *
 * 两张 benchmark 表结构一致（维度... + unit + low/median/high + crawled_at=YYYY-MM），
 * 区别只在维度名，所以用 props 描述：
 * @param {string} title - 卡片标题（如「广告 Benchmark」）
 * @param {string} table - 数据表名
 * @param {Array<{field: string, label: string}>} dims - 三级维度（顺序即联动顺序）
 * @param {number} height - 图表高度
 *
 * 取数分两步：先拉维度候选（GROUP BY，几百行），再按选中的组合拉该组合的月度序列（≤ 几十行），
 * 避免一上来把整张表几万行都拉到前端。
 */

const NOW_YEAR = new Date().getFullYear();
const LAST_YEAR = NOW_YEAR - 1;
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

/** 今年深色、去年浅色 */
const COLOR_NOW = '#4361ee';
const COLOR_LAST = '#9bb1f7';

const EMPTY_ROWS = [];

function toNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** SQL 字符串转义（维度值来自库里的中文标签） */
function sqlString(v) {
  return String(v ?? '').replace(/'/g, "''");
}

function transformOptions(rows) {
  return {
    rows: (rows || []).map((r) => ({ ...r, c: Number(r.c) || 0 })),
  };
}

function transformSeries(rows) {
  return {
    rows: (rows || [])
      .map((r) => {
        const [year, month] = String(r.crawled_at || '').split('-');
        return {
          year: Number(year),
          month,
          unit: r.unit || '',
          low: toNum(r.low),
          median: toNum(r.median),
          high: toNum(r.high),
        };
      })
      .filter((r) => r.month && Number.isFinite(r.year)),
  };
}

/** 按行数倒序的取值列表（数据越多的取值排前面，作为默认选中项更不容易是空图） */
function rankValues(list, field) {
  const counts = new Map();
  list.forEach((row) => {
    const key = row[field];
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + row.c);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'zh-CN'))
    .map(([key]) => key);
}

/** 单位 → y 轴标题 / 数值后缀 */
function unitMeta(unit) {
  if (unit === '%') return { title: '比率(%)', suffix: '%' };
  if (unit === '倍') return { title: '倍数', suffix: '倍' };
  if (unit === '元') return { title: '成本(元)', suffix: '' };
  return { title: unit ? `单位:${unit}` : '', suffix: '' };
}

export default function BenchmarkSection({ title, table, dims, height = 550 }) {
  const dimKey = dims.map((d) => d.field).join(',');

  /* 第一步：维度候选 + 每个候选的行数（用于排序和默认值） */
  const optionsSql = useMemo(
    () =>
      `SELECT ${dimKey.replace(/,/g, ', ')}, unit, COUNT(*) c
FROM ${table}
WHERE crawled_at >= '${LAST_YEAR}-01'
GROUP BY ${dimKey.replace(/,/g, ', ')}, unit`,
    [table, dimKey]
  );

  const optionsQuery = useChartData(
    `benchmark-options:${table}`,
    () => querySqlV09(optionsSql),
    {},
    { transform: transformOptions }
  );
  const optRows = optionsQuery.data?.rows || EMPTY_ROWS;

  /** 已选维度：父级变化时子级清空，由 active 自动落到该父级下数据最多的取值 */
  const [sel, setSel] = useState({});

  const active = useMemo(() => {
    if (!optRows.length) return null;
    const chosen = {};
    const options = {};
    let pool = optRows;
    dims.forEach((d) => {
      const opts = rankValues(pool, d.field);
      const pick = opts.includes(sel[d.field]) ? sel[d.field] : opts[0];
      chosen[d.field] = pick;
      options[d.field] = opts;
      pool = pool.filter((r) => r[d.field] === pick);
    });
    return { chosen, options, unit: pool[0]?.unit || '' };
  }, [optRows, sel, dims]);

  /* 第二步：选中组合的月度序列 */
  const selectionKey = active ? dims.map((d) => active.chosen[d.field]).join('|') : '';
  const seriesSql = active
    ? `SELECT crawled_at, unit, low, median, high
FROM ${table}
WHERE crawled_at >= '${LAST_YEAR}-01'
  AND ${dims.map((d) => `${d.field} = '${sqlString(active.chosen[d.field])}'`).join('\n  AND ')}
ORDER BY crawled_at ASC`
    : '';

  const seriesQuery = useChartData(
    `benchmark-series:${table}`,
    () => querySqlV09(seriesSql),
    { selection: selectionKey },
    { transform: transformSeries, enabled: !!seriesSql }
  );

  const seriesRows = seriesQuery.data?.rows || EMPTY_ROWS;

  /** 月度序列 → 12 个月 × 两年的区间带 + 均值线 */
  const chart = useMemo(() => {
    if (!seriesRows.length) return null;
    const byYear = { [NOW_YEAR]: new Map(), [LAST_YEAR]: new Map() };
    seriesRows.forEach((r) => {
      if (byYear[r.year]) byYear[r.year].set(r.month, r);
    });
    const hasNow = byYear[NOW_YEAR].size > 0;
    const hasLast = byYear[LAST_YEAR].size > 0;
    if (!hasNow && !hasLast) return null;

    /* 12 个月都建点（缺月 y=null）：数值轴上四条线的 x 完全一致，缺月自然留白 */
    const band = (year) =>
      MONTHS.map((m) => {
        const r = byYear[year].get(m);
        return { x: Number(m), y: r && r.low != null && r.high != null ? [r.low, r.high] : null };
      });
    const mid = (year) =>
      MONTHS.map((m) => {
        const v = byYear[year].get(m)?.median;
        return { x: Number(m), y: v == null ? null : v };
      });

    /* 只挂有数据的年份，避免图例里出现空系列；区间带排在均值线之前，保证带在线的下层 */
    const entries = [];
    if (hasNow) {
      entries.push({ name: `${NOW_YEAR} 区间(下限~上限)`, type: 'rangeArea', data: band(NOW_YEAR), color: COLOR_NOW, width: 0, dash: 0, fill: 0.18 });
    }
    if (hasLast) {
      entries.push({ name: `${LAST_YEAR} 区间(下限~上限)`, type: 'rangeArea', data: band(LAST_YEAR), color: COLOR_LAST, width: 1.4, dash: 4, fill: 0.1 });
    }
    if (hasNow) {
      entries.push({ name: `${NOW_YEAR} 均值`, type: 'line', data: mid(NOW_YEAR), color: COLOR_NOW, width: 3, dash: 0, fill: 1 });
    }
    if (hasLast) {
      entries.push({ name: `${LAST_YEAR} 均值`, type: 'line', data: mid(LAST_YEAR), color: COLOR_LAST, width: 2, dash: 6, fill: 1 });
    }

    /* x 轴收缩到有数的月份区间（单月数据时左右各留 1），避免小样本组合大半张图是空白 */
    const monthNums = MONTHS.filter((m) => byYear[NOW_YEAR].has(m) || byYear[LAST_YEAR].has(m)).map(Number);
    const spanMin = monthNums.length ? Math.min(...monthNums) : 1;
    const spanMax = monthNums.length ? Math.max(...monthNums) : 12;
    const xMin = spanMax - spanMin < 1 ? Math.max(1, spanMin - 1) : spanMin;
    const xMax = spanMax - spanMin < 1 ? Math.min(12, spanMax + 1) : spanMax;

    const months = [...new Set(seriesRows.map((r) => `${r.year}-${r.month}`))].sort((a, b) => a.localeCompare(b));

    return {
      series: entries.map(({ name, type, data }) => ({ name, type, data })),
      colors: entries.map((e) => e.color),
      strokeWidth: entries.map((e) => e.width),
      strokeDashArray: entries.map((e) => e.dash),
      fillOpacity: entries.map((e) => e.fill),
      markers: entries.map((e) => (e.type === 'line' ? 3 : 0)),
      coverage: months.length ? { count: months.length, from: months[0], to: months[months.length - 1] } : null,
      hasNow,
      hasLast,
      xMin,
      xMax,
    };
  }, [seriesRows]);

  const meta = unitMeta(active?.unit || seriesRows[0]?.unit);
  const yFormatter = meta.suffix ? (v) => `${v}${meta.suffix}` : null;
  const selectedText = active ? dims.map((d) => active.chosen[d.field]).join(' / ') : '';

  return (
    <div className="card border-0 shadow-sm mb-4">
      <div className="card-header bg-white border-0">
        <div className="fw-semibold">
          {title}
          {selectedText && <> — {selectedText}</>}
        </div>
        <div className="text-muted small mt-1">
          数据表 {table} · x 轴为自然月 · 区间带=下限 low ~ 上限 high，粗实线={NOW_YEAR} 均值 median，虚线={LAST_YEAR} 均值
          {active?.unit && <> · 单位:{active.unit}</>}
          {chart?.coverage && <> · 数据覆盖 {chart.coverage.count} 个月（{chart.coverage.from} ~ {chart.coverage.to}）</>}
        </div>
      </div>

      <div className="card-body">
        <div className="row g-2 mb-3">
          {dims.map((d, i) => (
            <div key={d.field} className="col-12 col-md-4">
              <label className="form-label small text-muted mb-1" htmlFor={`bench-${table}-${d.field}`}>
                {d.label} {d.field}
              </label>
              <select
                id={`bench-${table}-${d.field}`}
                className="form-select form-select-sm"
                value={active?.chosen[d.field] || ''}
                disabled={!active || !active.options[d.field]?.length}
                onChange={(e) => {
                  /* 改第 i 级时，把更深的层级清空，让它们重新落到新父级下的第一项 */
                  const next = {};
                  dims.slice(0, i).forEach((pd) => {
                    next[pd.field] = active?.chosen[pd.field] || '';
                  });
                  next[d.field] = e.target.value;
                  setSel(next);
                }}
              >
                {(active?.options[d.field] || []).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <RangeBandChart
          series={chart?.series || []}
          loading={optionsQuery.isLoading || seriesQuery.isLoading}
          error={optionsQuery.error?.message || seriesQuery.error?.message}
          height={height}
          xMin={chart?.xMin}
          xMax={chart?.xMax}
          yAxisTitle={meta.title}
          yFormatter={yFormatter}
          colors={chart?.colors}
          strokeWidth={chart?.strokeWidth}
          strokeDashArray={chart?.strokeDashArray}
          fillOpacity={chart?.fillOpacity}
          markers={chart?.markers}
          legendOverrides={{
            position: 'bottom',
            horizontalAlign: 'center',
            fontSize: '11px',
            itemMargin: { horizontal: 6, vertical: 2 },
            clusterGroupedSeries: false,
          }}
        />

        {chart && !chart.hasNow && (
          <div className="text-muted small mt-2">
            该组合 {NOW_YEAR} 年暂无数据，图上只有 {LAST_YEAR} 年的虚线与区间带。
          </div>
        )}
        {chart && !chart.hasLast && (
          <div className="text-muted small mt-2">
            该组合 {LAST_YEAR} 年暂无数据，图上只有 {NOW_YEAR} 年的实线与区间带。
          </div>
        )}
        {!chart && !optionsQuery.isLoading && !seriesQuery.isLoading && active && (
          <div className="text-muted small mt-2">该组合在 {LAST_YEAR}~{NOW_YEAR} 年暂无数据。</div>
        )}
      </div>
    </div>
  );
}
