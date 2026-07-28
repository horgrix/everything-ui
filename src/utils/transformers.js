/**
 * 数据转换器 — 将后端通用查询返回的 list[dict] 转为前端图表组件所需格式
 *
 * 每个转换器接受：rows + fieldMapping
 * fieldMapping 指定用哪些列映射到图表需要的字段
 */

// ==================== 辅助函数 ====================

/** 空数据安全处理 */
function ensureArray(data) {
  return Array.isArray(data) ? data : [];
}

/** 安全提取字段值 */
function getField(row, key, fallback = null) {
  if (row[key] !== undefined) return row[key];
  if (row[key?.toLowerCase()] !== undefined) return row[key.toLowerCase()];
  return fallback;
}

// ==================== KPI → 单对象 ====================

/**
 * 将汇总行转为 KPI 对象（取第一行）
 * @param {Array} rows - 通常只有一行
 * @param {Object} fieldMapping - { totalRevenue: 'sum_revenue', revenueGrowth: 'growth_rate', ... }
 * @returns {Object}
 */
export function toKPI(rows, fieldMapping = {}) {
  const row = ensureArray(rows)[0] || {};
  const kpi = {};
  for (const [key, col] of Object.entries(fieldMapping)) {
    kpi[key] = getField(row, col);
  }
  return kpi;
}

// ==================== 时序数据 → LineChart series ====================

/**
 * 将行数据转为时序 series 格式
 *
 * 支持两种数据形态：
 * 1. 多系列自动分组（需 group_by 字段）：
 *    [ {date: '2026-01', series_name: '营收', value: 1000}, ... ]
 *    fieldMapping: { x: 'date', group: 'series_name', y: 'value' }
 *
 * 2. 单系列简单格式：
 *    [ {date: '2026-01', revenue: 1000, cost: 800}, ... ]
 *    fieldMapping: { x: 'date', yFields: ['revenue', 'cost'] }
 *
 * @param {Array} rows
 * @param {Object} fieldMapping
 * @returns {{ series: Array<{name, data: Array<{x, y}>}> }}
 */
export function toTimeSeries(rows, fieldMapping = {}) {
  const data = ensureArray(rows);
  const xCol = fieldMapping.x || fieldMapping.date || 'date';

  // 形态 2：多列 Y 值（如 revenue, cost）
  if (fieldMapping.yFields && Array.isArray(fieldMapping.yFields)) {
    const series = fieldMapping.yFields.map((col) => ({
      name: fieldMapping.labels?.[col] || col,
      data: data.map((row) => ({
        x: getField(row, xCol),
        y: Number(getField(row, col, 0)),
      })),
    }));
    return { series };
  }

  // 形态 1：group_by 分组
  const groupCol = fieldMapping.group || 'series_name';
  const yCol = fieldMapping.y || 'value';
  const groups = {};
  for (const row of data) {
    const groupName = getField(row, groupCol, 'default');
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push({
      x: getField(row, xCol),
      y: Number(getField(row, yCol, 0)),
    });
  }
  const series = Object.entries(groups).map(([name, pts]) => ({
    name,
    data: pts,
  }));
  return { series };
}

// ==================== 分类对比 → BarChart series + categories ====================

/**
 * 将行数据转为柱状图格式
 *
 * 输入形态：
 * [ {category: '产品A', value1: 100, value2: 200}, ... ]
 * fieldMapping: { x: 'category', yFields: ['value1', 'value2'] }
 *
 * @param {Array} rows
 * @param {Object} fieldMapping
 * @returns {{ series: Array, categories: Array }}
 */
export function toCategoryChart(rows, fieldMapping = {}) {
  const data = ensureArray(rows);
  const xCol = fieldMapping.x || 'category';
  const yFields = fieldMapping.yFields || [];
  const categories = data.map((row) => getField(row, xCol));
  const series = yFields.map((col) => ({
    name: fieldMapping.labels?.[col] || col,
    data: data.map((row) => Number(getField(row, col, 0))),
  }));
  return { series, categories };
}

// ==================== 饼图 → PieChart series + labels ====================

/**
 * 将行数据转为饼图格式
 *
 * 输入：[ {label: '线上', value: 35}, ... ]
 * fieldMapping: { label: 'label', value: 'value' }
 *
 * @param {Array} rows
 * @param {Object} fieldMapping
 * @returns {{ series: Array<number>, labels: Array<string> }}
 */
export function toDistribution(rows, fieldMapping = {}) {
  const data = ensureArray(rows);
  const labelCol = fieldMapping.label || 'label';
  const valueCol = fieldMapping.value || 'value';
  const series = data.map((row) => Number(getField(row, valueCol, 0)));
  const labels = data.map((row) => String(getField(row, labelCol, '')));
  return { series, labels };
}

// ==================== K线 OHLC → CandlestickChart series ====================

/**
 * 将行数据转为 K 线格式
 *
 * 输入：[ {date: '2026-01', open: 100, high: 105, low: 99, close: 103}, ... ]
 * fieldMapping: { x: 'date', o: 'open', h: 'high', l: 'low', c: 'close' }
 *
 * @param {Array} rows
 * @param {Object} fieldMapping
 * @returns {{ series: Array<{name, data: Array<{x, y: [O,H,L,C]}>}> }}
 */
export function toOHLC(rows, fieldMapping = {}) {
  const data = ensureArray(rows);
  const xCol = fieldMapping.x || 'date';
  const oCol = fieldMapping.o || 'open';
  const hCol = fieldMapping.h || 'high';
  const lCol = fieldMapping.l || 'low';
  const cCol = fieldMapping.c || 'close';
  const name = fieldMapping.symbol || '标的';

  const ohlcData = data.map((row) => ({
    x: getField(row, xCol),
    y: [
      Number(getField(row, oCol, 0)),
      Number(getField(row, hCol, 0)),
      Number(getField(row, lCol, 0)),
      Number(getField(row, cCol, 0)),
    ],
  }));

  return { series: [{ name, data: ohlcData }] };
}

// ==================== 热力图 → HeatmapChart series ====================

/**
 * 将行数据转为热力图格式
 *
 * 输入：[ {row_label: '因子A', col_label: '因子B', value: 0.85}, ... ]
 * fieldMapping: { x: 'col_label', y: 'value', group: 'row_label' }
 *
 * @param {Array} rows
 * @param {Object} fieldMapping
 * @returns {{ series: Array<{name, data: Array<{x, y}>}> }}
 */
export function toHeatmap(rows, fieldMapping = {}) {
  const data = ensureArray(rows);
  const groupCol = fieldMapping.group || 'row_label';
  const xCol = fieldMapping.x || 'col_label';
  const yCol = fieldMapping.y || 'value';

  if (fieldMapping.series) {
    // 后端已格式化
    return { series: fieldMapping.series };
  }

  const groups = {};
  for (const row of data) {
    const groupName = getField(row, groupCol);
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push({
      x: getField(row, xCol),
      y: Number(getField(row, yCol, 0)),
    });
  }
  const series = Object.entries(groups).map(([name, pts]) => ({
    name,
    data: pts,
  }));
  return { series };
}

// ==================== 表格数据 → 直通 ====================

/**
 * 表格数据直接透传
 * @param {Array} rows
 * @returns {{ rows: Array, total: number }}
 */
export function toTable(rows, total = 0) {
  return { rows: ensureArray(rows), total };
}

// ==================== 聚合指标 → KPI 卡片数据 ====================

/**
 * 从聚合行中提取财务/量化指标
 * @param {Array} rows - 聚合查询结果
 * @param {Object} fieldMapping
 * @returns {Object} - 扁平指标对象
 */
export function toMetrics(rows, fieldMapping = {}) {
  return toKPI(rows, fieldMapping);
}