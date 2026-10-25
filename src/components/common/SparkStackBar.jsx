import { useState } from 'react';
import { formatNumber } from '../../utils/formatters';

/**
 * 表格内联「堆叠条」列（spark 列）
 * 一条水平堆叠条，总数值居中显示在条上，悬停显示各分段明细。
 *
 * @param {Array} segments [{ label, value, color }]
 * @param {number} height 条高，默认 18
 * @param {(v: number) => string} valueFormatter 数值格式化，默认千分位
 */
export default function SparkStackBar({ segments = [], height = 18, valueFormatter = formatNumber }) {
  const [pos, setPos] = useState(null);

  const items = segments.map((s) => ({ ...s, value: Number(s.value) || 0 }));
  const total = items.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return <span className="text-muted">-</span>;

  // 依次累加出每段的左右边界（百分比）
  let acc = 0;
  const bars = items
    .filter((s) => s.value > 0)
    .map((s) => {
      const left = acc;
      acc += s.value;
      return { ...s, left: (left / total) * 100, width: (s.value / total) * 100 };
    });

  return (
    <div
      className="position-relative"
      style={{ height, backgroundColor: '#e9ecef', borderRadius: 4, overflow: 'hidden' }}
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPos({ x: rect.left + rect.width / 2, y: rect.bottom + 6 });
      }}
      onMouseLeave={() => setPos(null)}
    >
      {bars.map((s) => (
        <div
          key={s.label}
          style={{
            position: 'absolute',
            left: `${s.left}%`,
            width: `${s.width}%`,
            top: 0,
            bottom: 0,
            backgroundColor: s.color,
          }}
        />
      ))}
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 600,
          color: '#fff',
          textShadow: '0 0 2px rgba(0,0,0,0.35)',
          pointerEvents: 'none',
        }}
      >
        {valueFormatter(total)}
      </span>
      {pos && (
        <div
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            transform: 'translateX(-50%)',
            background: 'rgba(33,37,41,0.95)',
            color: '#fff',
            padding: '6px 8px',
            borderRadius: 6,
            fontSize: 12,
            lineHeight: 1.6,
            whiteSpace: 'nowrap',
            zIndex: 2000,
            pointerEvents: 'none',
          }}
        >
          {items.map((s) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: s.color, flexShrink: 0 }} />
              <span>
                {s.label}：{valueFormatter(s.value)}
                {total > 0 ? `（${((s.value / total) * 100).toFixed(1)}%）` : ''}
              </span>
            </div>
          ))}
          <div style={{ marginTop: 2, opacity: 0.85 }}>合计：{valueFormatter(total)}</div>
        </div>
      )}
    </div>
  );
}
