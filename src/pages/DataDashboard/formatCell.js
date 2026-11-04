import { formatCompactNumber, formatCurrency, formatNumber, formatPercent, formatLarge } from '../../utils/formatters';

/** 按 columns[].format / items[].format 格式化单元格 */
export default function formatCell(value, format) {
  if (value == null || value === '') return '-';
  switch (format) {
    case 'money':
      return formatNumber(value, 1);
    case 'money-cny':
      return formatCurrency(value, 1);
    case 'percent':
      return formatPercent(value, 1);
    case 'compact':
      return formatCompactNumber(value, 1);
    case 'large':
      return formatLarge(value, 1);
    case 'number':
      return formatNumber(value, 0);
    default:
      // 没指定 format 时：数字默认千分位（整数不带小数），其余原样
      if (typeof value === 'number') return formatNumber(value, Number.isInteger(value) ? 0 : 2);
      return String(value);
  }
}
