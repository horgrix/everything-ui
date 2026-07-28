/**
 * 仪表盘 KPI 卡片组件
 * @param {string} title - 卡片标题
 * @param {string|number} value - 数值
 * @param {string} icon - Bootstrap Icons 类名
 * @param {string} color - 主题色 (primary/success/danger/warning/info)
 * @param {string} subtitle - 副标题（如同比变化）
 * @param {string} trend - 趋势方向: 'up' | 'down'
 */
export default function DashboardCard({
  title,
  value,
  icon = 'bi-graph-up',
  color = 'primary',
  subtitle = '',
  trend = '',
}) {
  const trendClass = trend === 'up' ? 'text-success' : trend === 'down' ? 'text-danger' : 'text-muted';
  const trendIcon = trend === 'up' ? 'bi-arrow-up' : trend === 'down' ? 'bi-arrow-down' : '';

  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <p className="text-muted small mb-1">{title}</p>
            <h4 className="fw-bold mb-1">{value}</h4>
            {subtitle && (
              <small className={trendClass}>
                {trendIcon && <i className={`bi ${trendIcon} me-1`}></i>}
                {subtitle}
              </small>
            )}
          </div>
          <div
            className={`rounded-3 bg-${color} bg-opacity-10 p-3 d-flex align-items-center justify-content-center`}
            style={{ width: 48, height: 48 }}
          >
            <i className={`bi ${icon} text-${color} fs-5`}></i>
          </div>
        </div>
      </div>
    </div>
  );
}