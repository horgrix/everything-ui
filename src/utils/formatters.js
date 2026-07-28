/**
 * 数值格式化工具
 */

/** 千分位格式化：1234567 -> "1,234,567" */
export function formatNumber(num, decimals = 0) {
  if (num == null) return '-';
  return Number(num).toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** 金额格式化：1234567 -> "¥1,234,567" */
export function formatCurrency(num, decimals = 2) {
  if (num == null) return '-';
  return '¥' + formatNumber(num, decimals);
}

/** 百分比格式化：0.1234 -> "12.34%" */
export function formatPercent(num, decimals = 2) {
  if (num == null) return '-';
  return (num * 100).toFixed(decimals) + '%';
}

/** 大数值缩写：1234567 -> "123.46万" */
export function formatLarge(num, decimals = 2) {
  if (num == null) return '-';
  if (Math.abs(num) >= 1e8) return (num / 1e8).toFixed(decimals) + '亿';
  if (Math.abs(num) >= 1e4) return (num / 1e4).toFixed(decimals) + '万';
  return formatNumber(num, decimals);
}

/** 日期格式化 */
export function formatDate(dateStr, withTime = false) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  const base = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (withTime) return `${base} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return base;
}