import { useId, useState } from 'react';

/** 默认涨/跌颜色（红涨绿跌，对齐 Bootstrap 语义色） */
const UP_COLOR = '#dc3545';
const DOWN_COLOR = '#198754';
const FALLBACK_COLOR = '#6c757d';

/**
 * 自绘 SVG 迷你折线图（sparkline），零外部依赖，支持悬停提示。
 *
 * @param {Array<number|null|undefined>} data 数值序列；null/undefined/NaN 会被跳过
 * @param {Array<string>} [labels] 每个数据点对应的标签（如日期），悬停时显示在提示里
 * @param {number} width 宽度（px）
 * @param {number} height 高度（px）
 * @param {string} [color] 线条颜色；缺省时按首尾值自动「红涨绿跌」
 */
export default function Sparkline({ data = [], labels = [], width = 120, height = 32, color }) {
  const gradId = `sparkline-grad-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [hoverIdx, setHoverIdx] = useState(null);
  const points = (data || []).filter((v) => typeof v === 'number' && Number.isFinite(v));

  let strokeColor = color;
  if (!strokeColor && points.length >= 2) {
    strokeColor = points[points.length - 1] >= points[0] ? UP_COLOR : DOWN_COLOR;
  }
  if (!strokeColor) strokeColor = FALLBACK_COLOR;

  const pad = 1.5;
  const innerH = height - pad * 2;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const x = (i) => (points.length > 1 ? (i * width) / (points.length - 1) : width / 2);
  const y = (v) => pad + innerH - ((v - min) / range) * innerH;

  const handleMove = (e) => {
    if (!points.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const idx = points.length > 1 ? Math.round((px / width) * (points.length - 1)) : 0;
    setHoverIdx(Math.max(0, Math.min(points.length - 1, idx)));
  };

  // 空数据占位：一条居中的虚线
  if (!points.length) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={{ display: 'block' }}>
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#dee2e6" strokeWidth="1" strokeDasharray="3 3" />
      </svg>
    );
  }

  const linePoints = points.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  const areaPath = points.length > 1
    ? `M ${x(0).toFixed(2)},${y(points[0]).toFixed(2)} ${points
        .slice(1)
        .map((v, i) => `L ${x(i + 1).toFixed(2)},${y(v).toFixed(2)}`)
        .join(' ')} L ${x(points.length - 1).toFixed(2)},${height} L ${x(0).toFixed(2)},${height} Z`
    : '';

  const tooltipLabel = hoverIdx != null ? labels?.[hoverIdx] : null;
  const tooltipValue = hoverIdx != null ? points[hoverIdx] : null;

  return (
    <div
      style={{ position: 'relative', display: 'inline-block', width, height, lineHeight: 0 }}
      onMouseMove={handleMove}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={{ display: 'block' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {areaPath && <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />}
        {points.length > 1 ? (
          <polyline
            points={linePoints}
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : (
          <circle cx={x(0)} cy={y(points[0])} r="2" fill={strokeColor} />
        )}
        {/* 透明命中区：扩大悬停命中范围 */}
        {points.length > 1 && (
          <polyline points={linePoints} fill="none" stroke="transparent" strokeWidth="8" />
        )}
        {hoverIdx != null && (
          <circle cx={x(hoverIdx)} cy={y(points[hoverIdx])} r="3" fill={strokeColor} stroke="#fff" strokeWidth="1" />
        )}
      </svg>
      {hoverIdx != null && (
        <div
          style={{
            position: 'absolute',
            left: Math.max(0, Math.min(x(hoverIdx), width)),
            top: -6,
            transform: 'translate(-50%, -100%)',
            background: 'rgba(33,37,41,0.92)',
            color: '#fff',
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: 11,
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {tooltipLabel != null ? `${tooltipLabel}：${tooltipValue}` : String(tooltipValue)}
        </div>
      )}
    </div>
  );
}
