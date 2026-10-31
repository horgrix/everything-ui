import { formatNumber } from '../../utils/formatters';
import { growthOf } from './data';

/** 环比胶囊配色：绿涨 / 红跌 */
const PILL_TONE = {
  up: { background: 'rgba(111,143,113,0.18)', color: '#4B7A54' },
  down: { background: 'rgba(178,124,120,0.18)', color: '#A0554F' },
  flat: { background: 'rgba(122,139,153,0.14)', color: '#63727E' },
};

/** 环比胶囊：▲ +41.7% */
export function GrowthPill({ cur, prev, compact = false }) {
  const g = growthOf(cur, prev);
  if (!g) return null;
  const tone = PILL_TONE[g.tone];
  const icon = g.tone === 'up' ? 'bi-caret-up-fill' : g.tone === 'down' ? 'bi-caret-down-fill' : null;
  return (
    <span
      style={{
        ...tone,
        fontSize: compact ? 10 : 11,
        fontWeight: 600,
        lineHeight: 1.5,
        padding: compact ? '1px 6px' : '1px 7px',
        borderRadius: 999,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      }}
    >
      {icon && <i className={`bi ${icon} me-1`} style={{ fontSize: 7, verticalAlign: 1 }}></i>}
      {g.label}
    </span>
  );
}

/** 单个指标：小标签 + 主数值 + 环比胶囊 */
export function Metric({ label, value, prev, hideGrowth = false, labelLines = 1, colClass = 'col-6', compact = false, decimals = 0 }) {
  const text = value == null ? '—' : typeof value === 'number' ? formatNumber(value, decimals) : value;
  return (
    <div className={colClass}>
      <div style={{ paddingRight: 10 }}>
        <div
          style={{
            fontSize: 11,
            color: '#9AA4AD',
            letterSpacing: 0.2,
            lineHeight: '15px',
            minHeight: labelLines * 15,
            whiteSpace: 'normal',
            // 中文标签只在空格/标点处断行，避免把「抓取游戏数」拆开
            wordBreak: 'keep-all',
            overflowWrap: 'anywhere',
            display: '-webkit-box',
            WebkitLineClamp: labelLines,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
          title={label}
        >
          {label}
        </div>
        <div
          className="d-flex flex-wrap"
          style={
            compact
              ? { gap: 3, marginTop: 3, flexDirection: 'column', alignItems: 'flex-start' }
              : { gap: 6, marginTop: 3, alignItems: 'baseline' }
          }
        >
          <span
            style={{
              fontSize: compact ? 18 : 21,
              fontWeight: 600,
              lineHeight: 1.25,
              letterSpacing: -0.2,
              color: value == null ? '#C4CBD1' : '#1F272E',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {text}
          </span>
          {!hideGrowth && (
            <span title={prev == null ? '上周无数据' : `上周：${formatNumber(prev, decimals)}`}>
              <GrowthPill cur={value} prev={prev} compact={compact} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** 一个分组：圆点 + 小标题 + 指标网格（4/3 项各占一行，其余一行 2 个） */
export function Section({ color, title, items, hideGrowth, first = false, labelLines = 1 }) {
  return (
    <div style={first ? undefined : { marginTop: 16, paddingTop: 16, borderTop: '1px dashed #F0F3F5' }}>
      <div className="d-flex align-items-center" style={{ gap: 7, marginBottom: 11 }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, flex: '0 0 auto' }}></span>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.1, color: '#7A868F' }}>{title}</span>
      </div>
      {items.every((it) => it.value == null) ? (
        <div style={{ fontSize: 11.5, color: '#A7B0B8' }}>该周期暂无数据</div>
      ) : (
        <div className="row g-0" style={{ rowGap: 14 }}>
          {items.map((it) => (
            <Metric
              key={it.label}
              {...it}
              hideGrowth={hideGrowth}
              labelLines={labelLines}
              colClass={items.length >= 4 ? 'col-6 col-md-3' : items.length === 3 ? 'col-6 col-md-4' : 'col-6'}
              compact={items.length >= 4}
            />
          ))}
        </div>
      )}
    </div>
  );
}
