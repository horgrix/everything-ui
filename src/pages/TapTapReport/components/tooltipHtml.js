/**
 * 图表 tooltip 的 HTML 拼装工具
 *
 * 各页面自定义 tooltip 都要输出一样的「标题 + 色块/名称/数值」列表，
 * 之前每处各写一遍字符串模板，这里统一成一份。
 */

/**
 * 单行读数（色块 + 名称 + 右对齐数值）
 * @param {{ name: string, color?: string, value: string|number, strong?: boolean }} row
 */
export function tooltipRow({ name, color, value, strong = false }) {
  const dot = color
    ? `<span style="width:8px;height:8px;border-radius:2px;background:${color};display:inline-block;"></span>`
    : '';
  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
    <span style="display:inline-flex;align-items:center;gap:6px;">${dot}<span>${name}</span></span>
    <span style="font-weight:${strong ? 700 : 600};">${value}</span>
  </div>`;
}

/**
 * 完整 tooltip：标题 + 多行 + 可选分隔的合计行
 * @param {Object} params
 * @param {string} params.title 顶部标题（如「周四」「2026-11-08 16」）
 * @param {Array<{name:string,color?:string,value:string|number}>} params.rows 明细行
 * @param {{name:string,color?:string,value:string|number}} [params.total] 合计行（带分割线）
 * @param {number} [params.minWidth] 最小宽度，默认 200
 */
export function tooltipHtml({ title, rows = [], total = null, minWidth = 200 }) {
  const body = rows.map((r) => tooltipRow(r)).join('');
  const totalHtml = total
    ? `<div style="margin-top:2px;padding-top:3px;border-top:1px solid #EDF0F2;">${tooltipRow({
        ...total,
        strong: true,
      })}</div>`
    : '';
  return `<div style="padding:6px 4px;font-size:12px;line-height:1.7;min-width:${minWidth}px;">
    <div style="font-weight:600;margin-bottom:4px;">${title ?? ''}</div>
    ${body}${totalHtml}
  </div>`;
}

/** 数值格式化兜底：null/NaN → '-' */
export function tooltipValue(value, formatter) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return formatter ? formatter(Number(value)) : String(value);
}
