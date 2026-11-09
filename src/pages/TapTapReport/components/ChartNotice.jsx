/** 口径变更等提示条（浅琥珀底；compact 用于卡片头右上角的紧凑版） */
export default function ChartNotice({ children, compact = false }) {
  return (
    <div
      className={compact ? 'd-flex gap-2 px-2 py-1 rounded-2' : 'd-flex gap-2 mb-2 px-3 py-2 rounded-3'}
      style={{
        backgroundColor: '#FFF9EC',
        border: '1px solid #F1E3C3',
        maxWidth: compact ? 360 : undefined,
      }}
    >
      <i
        className="bi bi-exclamation-triangle-fill"
        style={{ fontSize: compact ? 11 : 13, lineHeight: compact ? '16px' : '20px', color: '#C08A2E' }}
        aria-hidden="true"
      ></i>
      <div style={{ fontSize: compact ? 11 : 12, lineHeight: compact ? '16px' : '20px', color: '#7A5C22', minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}

/** 热门游戏TopN下载月趋势卡片（带 totalLabels 的堆叠柱，宽 35%） */
