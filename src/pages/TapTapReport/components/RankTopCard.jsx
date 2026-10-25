import BarChart from '../../../components/charts/BarChart';
import { formatCompactNumber } from '../../../utils/formatters';
import { truncateName } from '../shared';

/**
 * 投放 TopN 排名卡（横向柱状图）
 * y=「名次. 游戏名称」，x=总投放；柱内显示数值；无数据时展示空状态文案。
 *
 * @param {string} title 卡片标题
 * @param {string} subtitle 口径说明
 * @param {string} [rangeLabel] 快照前缀（如「数据日期」）
 * @param {string} [snapshot] 快照值（如 2026-10-25 / 2026-42）
 * @param {string} [sourceNote] 数据来源补充说明（如「按明细表推算」）
 * @param {Array} rows [{ rank, appName, totalAdViews }]
 * @param {string} [emptyText] 无数据时的提示
 * @param {boolean} loading
 * @param {string} [error]
 * @param {number} height 图表高度
 */
export default function RankTopCard({
  title,
  subtitle,
  rangeLabel = '快照',
  snapshot = '',
  sourceNote = '',
  rows = [],
  emptyText = '暂无数据',
  loading = false,
  error = null,
  height = 500,
}) {
  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-header bg-white border-0">
        <div className="fw-semibold">{title}</div>
        <div className="d-flex align-items-center flex-wrap gap-2 mt-1">
          <span className="text-muted small">{subtitle}</span>
          {snapshot && (
            <span className="text-muted small">
              {rangeLabel}：{snapshot}
              {sourceNote ? `（${sourceNote}）` : ''}
            </span>
          )}
        </div>
      </div>
      <div className="card-body">
        {error ? (
          <div className="alert alert-warning text-center mb-0" role="alert">
            <i className="bi bi-exclamation-triangle me-2"></i>
            {error}
          </div>
        ) : !loading && rows.length === 0 ? (
          <div className="d-flex align-items-center justify-content-center text-muted small" style={{ height }}>
            <span>
              <i className="bi bi-inboxes me-1"></i>
              {emptyText}
            </span>
          </div>
        ) : (
          <BarChart
            series={[{ name: '总投放', data: rows.map((r) => r.totalAdViews) }]}
            loading={loading}
            height={height}
            horizontal
            toolbar={false}
            colors={['#8FA3B0']}
            dataLabels={{
              enabled: true,
              style: { fontSize: '11px', fontWeight: 600, colors: ['#ffffff'] },
            }}
            /* 横向柱：xaxis.categories 是左侧分类轴，xaxis 数值刻度用紧凑格式；
               不要给 yaxis.labels 加 formatter —— Apex 会把分类文案也丢进 formatter，非数字会被格式化掉 */
            xaxisOverrides={{
              categories: rows.map((r) => `${r.rank}. ${truncateName(r.appName)}`),
              labels: { formatter: (v) => formatCompactNumber(Number(v)) },
            }}
            legendOverrides={{ show: false }}
          />
        )}
      </div>
    </div>
  );
}
