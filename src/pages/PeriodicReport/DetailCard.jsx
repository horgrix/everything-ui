/**
 * 详情页卡片（DetailCard）
 *
 * 只负责「外壳 + 排版基座」：卡面、标题栏、正文容器都在这层统一好。
 * 具体内容由调用方通过 children 自己排（后续在这里写各自的布局即可）。
 *
 * 用法：
 *   <DetailCard title="TAPTAP 广告概览" subtitle="对比上一期" color="#BFAE8E">
 *     ...自定布局...
 *   </DetailCard>
 */
export default function DetailCard({ title, subtitle, color = '#7A8B99', children = null, className = '', style }) {
  return (
    <div className={`pr-card pr-detail-card ${className}`.trim()} style={style}>
      {(title || subtitle) && (
        <div className="pr-detail-card__head">
          <span className="pr-detail-card__dot" style={{ backgroundColor: color }} aria-hidden="true"></span>
          {title && <span className="pr-detail-card__title">{title}</span>}
          {subtitle && <span className="pr-detail-card__subtitle">{subtitle}</span>}
        </div>
      )}

      <div className="pr-detail-card__body">
        {children ?? (
          <div className="pr-detail-card__placeholder">
            <i className="bi bi-layout-text-window-reverse"></i>
            <span>内容待排版</span>
          </div>
        )}
      </div>
    </div>
  );
}
