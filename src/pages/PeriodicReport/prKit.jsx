/**
 * 定期报告 · 展示原语（数字格式 / 迷你趋势 / 环比标签 / 面板壳）
 *
 * 页面只做「呈现」：值、上期、环比、可用期数、是否缺值全部由后端聚合接口给出，
 * 这里不再推算任何统计口径。
 */
import { useId } from 'react';

/* ------------------------------------------------------------------ 业务线 */

export const LINE_META = {
  download: { label: 'TapTap 下载', short: '下载', color: '#3F7A5E', tint: '#EAF3EE', icon: 'bi-cloud-arrow-down' },
  ad: { label: 'TapTap 广告', short: '广告', color: '#A8683C', tint: '#F8EFE8', icon: 'bi-megaphone' },
  online: { label: 'TapTap PC 在线', short: '在线', color: '#3E6E9E', tint: '#EAF1F7', icon: 'bi-people' },
  overview: { label: '按游戏', short: '按游戏', color: '#6B5B86', tint: '#F1EEF7', icon: 'bi-controller' },
};

export const LEVEL_META = {
  high: { label: '高', color: '#B4483F', bg: 'rgba(180,72,63,0.10)' },
  medium: { label: '中', color: '#9A7A35', bg: 'rgba(154,122,53,0.12)' },
  low: { label: '低', color: '#5C6873', bg: 'rgba(92,104,115,0.10)' },
  info: { label: '说明', color: '#5C6873', bg: 'rgba(92,104,115,0.08)' },
};

/* ------------------------------------------------------------------ 数字格式 */

const CN_UNITS = [
  { limit: 1e8, suffix: '亿' },
  { limit: 1e4, suffix: '万' },
];

/** 完整千分位：10,475,431 */
export function fmtFull(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const num = Number(value);
  const digits = Math.abs(num) % 1 === 0 ? 0 : 2;
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

/** 紧凑中文单位：1047.5 万 / 1.05 亿；用于大字与坐标轴 */
export function fmtCompact(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const num = Number(value);
  const abs = Math.abs(num);
  const unit = CN_UNITS.find((item) => abs >= item.limit);
  if (!unit) return abs % 1 === 0 ? String(Math.round(num)) : num.toFixed(digits);
  const scaled = num / unit.limit;
  const fixed = Math.abs(scaled) >= 100 ? scaled.toFixed(0) : scaled.toFixed(digits);
  return `${fixed} ${unit.suffix}`;
}

/** 大字展示：数值 + 单位（紧凑） */
export function headline(value, unit, digits = 1) {
  if (value == null) return { text: '—', unit: '' };
  // 「次 / 人 / 款」这类单位在紧凑数值后单独排小字
  return { text: fmtCompact(value, digits), unit };
}

/** 环比文案：+40.4% / −12.0%；null → null（调用方决定显示什么） */
export function fmtPct(pct) {
  if (pct == null || Number.isNaN(Number(pct))) return null;
  const num = Number(pct);
  if (num === 0) return '0.0%';
  return `${num > 0 ? '+' : '−'}${Math.abs(num).toFixed(1)}%`;
}

/** 绝对变化：+301.6 万 */
export function fmtAbs(abs, unit, digits = 1) {
  if (abs == null || Number.isNaN(Number(abs))) return null;
  const num = Number(abs);
  if (num === 0) return `0 ${unit || ''}`.trim();
  return `${num > 0 ? '+' : '−'}${fmtCompact(Math.abs(num), digits)} ${unit || ''}`.trim();
}

/** ISO → 11-16 14:49 */
export function fmtDateTime(iso) {
  if (!iso) return null;
  const text = String(iso);
  if (text.length < 16) return text;
  return text.slice(5, 16).replace('T', ' ');
}

/** 2026-11-09 → 11.09 */
export function fmtDay(date) {
  if (!date) return '';
  const [, m, d] = String(date).split('-');
  return m && d ? `${m}.${d}` : String(date);
}

/* ------------------------------------------------------------------ 基础壳 */

export function Panel({ children, className = '', style, as: Tag = 'div' }) {
  return (
    <Tag className={`pr-panel ${className}`.trim()} style={style}>
      {children}
    </Tag>
  );
}

export function PanelHead({ color, icon, title, sub, right, tag }) {
  return (
    <div className="pr-panel-head">
      <span className="pr-panel-icon" style={{ color: color || '#5C6873', background: `${color || '#5C6873'}14` }}>
        <i className={`bi ${icon || 'bi-bar-chart'}`} />
      </span>
      <div className="pr-panel-title">
        <div className="pr-panel-title-text">
          {title}
          {tag}
        </div>
        {sub && <div className="pr-panel-sub">{sub}</div>}
      </div>
      {right && <div className="pr-panel-right">{right}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ 环比胶囊 */

/**
 * @param {Object} props
 * @param {number|null} props.pct   环比百分比（后端 deltaPct）
 * @param {number|null} props.abs   绝对变化（后端 deltaAbs）
 * @param {string} props.unit
 * @param {boolean} props.comparable 本期是否走完（未完时只作参考）
 * @param {boolean} props.hasValue  本期是否有值
 * @param {boolean} props.insufficientHistory 历史不足时不给涨跌结论
 * @param {boolean} props.showAbs   是否显示绝对变化
 */
export function DeltaChip({ pct, abs, unit, comparable = true, hasValue = true, insufficientHistory, showAbs = false, size }) {
  if (!hasValue) {
    return <span className="pr-chip is-empty">本期无数据</span>;
  }
  const text = fmtPct(pct);
  if (!text) {
    return (
      <span className="pr-chip is-empty" title="上一期没有同口径数据，不计算环比">
        上期无数据
      </span>
    );
  }
  const tone = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  const absText = showAbs ? fmtAbs(abs, unit) : null;
  const title = [
    comparable ? null : '本期尚未结束，环比只作参考',
    insufficientHistory ? '该指标可用期数不足 3 期，涨跌不代表趋势' : null,
  ]
    .filter(Boolean)
    .join('；');
  return (
    <span
      className={`pr-chip is-${tone}${comparable ? '' : ' is-soft'}`}
      style={size === 'sm' ? { fontSize: 10.5 } : undefined}
      title={title || undefined}
    >
      <i
        className={`bi ${tone === 'up' ? 'bi-arrow-up-right' : tone === 'down' ? 'bi-arrow-down-right' : 'bi-dash'} pr-chip-ico`}
      />
      {text}
      {absText && <span className="pr-chip-abs">{absText}</span>}
      {!comparable && <span className="pr-chip-note">参考</span>}
    </span>
  );
}

/** 可用期数徽标：5/7 期 */
export function Coverage({ available, total }) {
  const count = Array.isArray(available) ? available.length : available;
  const isPartial = typeof count === 'number' && typeof total === 'number' && count < total;
  return (
    <span
      className={`pr-coverage${isPartial ? ' is-partial' : ''}`}
      title={
        typeof count === 'number' && typeof total === 'number'
          ? `趋势可画 ${count} 期，共 ${total} 期（缺值期不补 0）`
          : undefined
      }
    >
      {typeof count === 'number' ? `${count}/${total} 期` : '—'}
    </span>
  );
}

/* ------------------------------------------------------------------ 迷你趋势 */

/**
 * 纯 SVG 迷你趋势：面积 + 折线 + 末点。
 * 只有 1 个点时不画线（一期构不成趋势），缺值点由后端剔除，不会补 0。
 */
export function Sparkline({ points = [], color = '#5C6873', height = 38, strokeWidth = 1.8, fill = true }) {
  const gid = useId().replace(/[^\w-]/g, '');
  const values = (points || []).map((p) => (typeof p === 'number' ? p : p?.value)).filter((v) => v != null);

  if (values.length < 2) {
    return (
      <div className="pr-spark-empty" style={{ height }}>
        {values.length === 1 ? '仅 1 期' : '暂无趋势'}
      </div>
    );
  }

  const width = 100;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.abs(max) || 1;
  const stepX = width / (values.length - 1);
  const padY = 4;
  const axisY = (v) => height - padY - ((v - min) / span) * (height - padY * 2);
  const line = values.map((v, i) => `${(i * stepX).toFixed(2)},${axisY(v).toFixed(2)}`).join(' ');
  const area = `0,${height} ${line} ${width},${height}`;
  const lastX = width;
  const lastY = axisY(values[values.length - 1]);

  return (
    <svg className="pr-spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ height }} aria-hidden="true">
      <defs>
        <linearGradient id={`spk${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.26" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {fill && <polygon points={area} fill={`url(#spk${gid})`} />}
      <polyline points={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lastX} cy={lastY} r="2.2" fill="#fff" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** 骨架 / 空态 */
export function Placeholder({ height = 120, icon = 'bi-inbox', children }) {
  return (
    <div className="pr-placeholder" style={{ minHeight: height }}>
      <i className={`bi ${icon}`} />
      <span>{children}</span>
    </div>
  );
}
