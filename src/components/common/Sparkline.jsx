import { useId, useState } from 'react';

/** 默认涨/跌颜色（红涨绿跌，对齐 Bootstrap 语义色） */
const UP_COLOR = '#dc3545';
const DOWN_COLOR = '#198754';
const FALLBACK_COLOR = '#6c757d';
/** 对比序列（上周等）默认颜色：中性灰 */
const PREV_COLOR = '#B0AAA4';

/**
 * 自绘 SVG 迷你折线图（sparkline），零外部依赖，支持悬停提示。
 *
 * 带 `prevData` 时进入「对比模式」：主序列用实线加粗，对比序列用虚线，
 * 两者按数组索引对齐（适合「本周 vs 上周」按周几对比）。
 *
 * @param {Array<number|null|undefined>} data 主序列；null/undefined/NaN 处不画点（但保留位置）
 * @param {Array<string>} [labels] 每个索引对应的标签（如「周一」），悬停时显示
 * @param {number} width 宽度（px）
 * @param {number} height 高度（px）
 * @param {string} [color] 主线颜色；缺省时按首尾值自动「红涨绿跌」
 * @param {Array<number|null|undefined>} [prevData] 对比序列（与 data 同长度、按索引对齐），虚线绘制
 * @param {string} [prevColor] 对比序列颜色
 * @param {string} [currentLabel] 主序列名称（对比模式下 tooltip 显示）
 * @param {string} [prevLabel] 对比序列名称（对比模式下 tooltip 显示）
 */
export default function Sparkline({
  data = [],
  labels = [],
  width = 120,
  height = 32,
  color,
  prevData = null,
  prevColor = PREV_COLOR,
  currentLabel = '本周',
  prevLabel = '上周',
}) {
  const gradId = `sparkline-grad-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [hoverIdx, setHoverIdx] = useState(null);

  const toNum = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const cur = (data || []).map(toNum);
  const prev = prevData ? prevData.map(toNum) : null;
  const n = Math.max(cur.length, prev ? prev.length : 0);
  const prevCount = prev ? prev.filter((v) => v != null).length : 0;
  const curCount = cur.filter((v) => v != null).length;

  const allVals = [...cur, ...(prev || [])].filter((v) => v != null);
  const hasData = allVals.length > 0;

  // 自动配色：仅看主序列
  const curVals = cur.filter((v) => v != null);
  let strokeColor = color;
  if (!strokeColor && curVals.length >= 2) {
    strokeColor = curVals[curVals.length - 1] >= curVals[0] ? UP_COLOR : DOWN_COLOR;
  }
  if (!strokeColor) strokeColor = FALLBACK_COLOR;

  const pad = 1.5;
  const innerH = height - pad * 2;
  const min = hasData ? Math.min(...allVals) : 0;
  const max = hasData ? Math.max(...allVals) : 1;
  const range = max - min || 1;
  // x 按原数组索引定位（null 占位但不画点），保证多序列/多行标签对齐
  const x = (i) => (n > 1 ? (i * width) / (n - 1) : width / 2);
  const y = (v) => pad + innerH - ((v - min) / range) * innerH;

  const handleMove = (e) => {
    if (!hasData) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const idx = n > 1 ? Math.round((px / width) * (n - 1)) : 0;
    setHoverIdx(Math.max(0, Math.min(n - 1, idx)));
  };

  // 空数据占位：一条居中的虚线
  if (!hasData) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={{ display: 'block' }}>
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#dee2e6" strokeWidth="1" strokeDasharray="3 3" />
      </svg>
    );
  }

  const polyOf = (arr) =>
    arr
      .map((v, i) => (v == null ? null : `${x(i).toFixed(2)},${y(v).toFixed(2)}`))
      .filter(Boolean)
      .join(' ');

  const curPoints = polyOf(cur);
  const prevPoints = prev ? polyOf(prev) : '';
  const curIdxs = cur.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0);
  const areaPath = curIdxs.length > 1
    ? `M ${x(curIdxs[0]).toFixed(2)},${y(cur[curIdxs[0]]).toFixed(2)} ${curIdxs
        .slice(1)
        .map((i) => `L ${x(i).toFixed(2)},${y(cur[i]).toFixed(2)}`)
        .join(' ')} L ${x(curIdxs[curIdxs.length - 1]).toFixed(2)},${height} L ${x(curIdxs[0]).toFixed(2)},${height} Z`
    : '';

  const isCompare = prev != null;
  const curStrokeWidth = isCompare ? 2.5 : 1.5; // 对比模式下主线加粗
  const hoverCur = hoverIdx != null ? cur[hoverIdx] : null;
  const hoverPrev = hoverIdx != null && prev ? prev[hoverIdx] : null;
  const hoverLabel = hoverIdx != null ? labels?.[hoverIdx] : null;

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

        {/* 对比序列（上周）：虚线、细、画在底层 */}
        {prevCount > 1 && (
          <polyline
            points={prevPoints}
            fill="none"
            stroke={prevColor}
            strokeWidth="1.2"
            strokeDasharray="3 2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {areaPath && <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />}

        {/* 主序列（本周）：实线、加粗 */}
        {curCount > 1 ? (
          <polyline
            points={curPoints}
            fill="none"
            stroke={strokeColor}
            strokeWidth={curStrokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : curCount === 1 ? (
          <circle cx={x(curIdxs[0])} cy={y(cur[curIdxs[0]])} r="2" fill={strokeColor} />
        ) : null}

        {/* 透明命中区：扩大悬停命中范围 */}
        {curCount > 1 && <polyline points={curPoints} fill="none" stroke="transparent" strokeWidth="8" />}
        {isCompare && prevCount > 1 && <polyline points={prevPoints} fill="none" stroke="transparent" strokeWidth="8" />}

        {hoverCur != null && (
          <circle cx={x(hoverIdx)} cy={y(hoverCur)} r="3" fill={strokeColor} stroke="#fff" strokeWidth="1" />
        )}
        {hoverPrev != null && (
          <circle cx={x(hoverIdx)} cy={y(hoverPrev)} r="2.5" fill={prevColor} stroke="#fff" strokeWidth="1" />
        )}
      </svg>

      {hoverIdx != null && (hoverCur != null || hoverPrev != null) && (
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
          {hoverLabel != null && <div style={{ opacity: 0.75 }}>{hoverLabel}</div>}
          {isCompare ? (
            <>
              <div>{currentLabel}：{hoverCur != null ? hoverCur : '-'}</div>
              <div>{prevLabel}：{hoverPrev != null ? hoverPrev : '-'}</div>
            </>
          ) : (
            <div>{hoverCur != null ? hoverCur : '-'}</div>
          )}
        </div>
      )}
    </div>
  );
}
