import UpdateTag from '../UpdateTag';

/**
 * 报表卡片外壳：统一「标题 + 副标题/说明 + 更新时间」的卡片头结构。
 *
 * 用法：
 *   <ChartCard title="…" subtitle="…" updateLabel="下次更新时间 …">
 *     <BarChart … />
 *   </ChartCard>
 *
 * @param {string} title 标题
 * @param {ReactNode} subtitle 标题下的说明（可多段，自动换行）
 * @param {string} updateLabel 更新时间文案（传入则渲染 UpdateTag）
 * @param {ReactNode} actions 卡片头右侧操作区（如筛选胶囊）
 * @param {ReactNode} notice 卡片头右上角的提示条（如口径变更告警）
 * @param {boolean} body 是否包一层 card-body（图表类传 true，表格类传 false）
 * @param {string} bodyClassName 追加到 card-body 的类名
 * @param {number} minHeight 卡片最小高度（同一行需要等高时用）
 */
export default function ChartCard({
  title,
  subtitle = null,
  updateLabel = null,
  actions = null,
  notice = null,
  body = false,
  bodyClassName = '',
  minHeight = null,
  children,
}) {
  const hasRight = Boolean(actions || notice);
  return (
    <div className="card border-0 shadow-sm h-100" style={minHeight ? { minHeight } : undefined}>
      <div
        className={
          hasRight
            ? 'card-header bg-white border-0 d-flex align-items-start justify-content-between gap-2 flex-wrap'
            : 'card-header bg-white border-0'
        }
      >
        <div style={{ minWidth: 0 }}>
          <div className="fw-semibold">{title}</div>
          {(subtitle || updateLabel) && (
            <div className="mt-1 d-flex align-items-center flex-wrap gap-2">
              {subtitle ? <span className="text-muted small">{subtitle}</span> : null}
              {updateLabel ? <UpdateTag text={updateLabel} /> : null}
            </div>
          )}
        </div>
        {hasRight && (
          <div className="ms-auto d-flex align-items-center gap-2 flex-wrap">
            {actions}
            {notice}
          </div>
        )}
      </div>
      {body ? <div className={`card-body ${bodyClassName}`.trim()}>{children}</div> : children}
    </div>
  );
}
