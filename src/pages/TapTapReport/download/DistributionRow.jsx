import PieChart from '../../../components/charts/PieChart';
import DataTable from '../components/DataTable';
import ChartCard from '../components/ChartCard';
import { DISTRIBUTION_COLORS, labelToFilterValue } from './constants';
import { TOP25_DETAIL_COLUMNS, TOP25_DETAIL_TABLES } from './columns';

/**
 * 一行：左 35% 分布饼图（带筛选胶囊、点扇区联动）、右 65% 对应明细表
 * @param {string} distKey platform | gameType（分布口径）
 * @param {string} tableKey platform | gameType（明细表配置 key）
 * @param {Object} dist 分布数据 { title, series, labels, totalLabel, totalValue, loading, error }
 * @param {Object} filter { selected, setSelected, options, strokeColors }
 * @param {Array} rows 明细行
 * @param {Object} trend 趋势列配置 { metric, label, day }
 */
export default function DistributionRow({
  distKey,
  tableKey,
  dist,
  filter,
  rows,
  trend,
  updateLabel,
}) {
  const table = TOP25_DETAIL_TABLES[tableKey];
  return (
    <div className="row g-3 mb-4">
      {/* 追踪的游戏分布（宽 35%） */}
      <div className="col-12 tt-split-35">
        <ChartCard
          title={dist?.title || ''}
          updateLabel={updateLabel}
          body
          bodyClassName="d-flex flex-column align-items-center justify-content-center"
          actions={
            <div className="d-flex align-items-center gap-1 flex-wrap">
              <span className="text-muted" style={{ fontSize: 11 }}>明细筛选</span>
              <button
                type="button"
                className={`btn btn-sm ${filter.selected == null ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={{ fontSize: 11, padding: '1px 8px' }}
                onClick={() => filter.setSelected(null)}
              >
                全部
              </button>
              {filter.options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`btn btn-sm ${filter.selected === opt.value ? 'btn-primary' : 'btn-outline-secondary'}`}
                  style={{ fontSize: 11, padding: '1px 8px' }}
                  onClick={() => filter.setSelected(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          }
        >
          <PieChart
            series={dist?.series || []}
            labels={dist?.labels || []}
            loading={dist?.loading}
            error={dist?.error}
            height={300}
            donut
            // 小游戏的扇区名较长，标签只显示百分比，名称交给图例，避免压住圆心「小游戏数」
            percentOnly={distKey === 'gameType'}
            colors={DISTRIBUTION_COLORS}
            sliceStrokeColors={filter.strokeColors}
            sliceStrokeWidth={filter.selected != null ? 2.5 : 1}
            legendOverrides={{ horizontalAlign: 'center' }}
            totalLabel={dist?.totalLabel}
            totalValue={dist?.totalValue}
            onDataClick={({ label }) => {
              const value = labelToFilterValue(distKey, label);
              if (value == null) return;
              // 再点一次已选中的扇区即取消筛选（回到全部）
              filter.setSelected((prev) => (prev === value ? null : value));
            }}
          />
        </ChartCard>
      </div>

      {/* 下载TopN明细（占剩余 65%） */}
      <div className="col-12 tt-split-65">
        <ChartCard title={table.title} updateLabel={updateLabel}>
          <DataTable
            rows={rows}
            columns={TOP25_DETAIL_COLUMNS(null, {
              withOneSearch: true,
              withPlatform: !!table.withPlatform,
              withType: !!table.withType,
              trend,
            })}
            tableClassName="top25-table"
            fixedLayout
            rankColWidth={table.rankWidth || '6%'}
          />
        </ChartCard>
      </div>
    </div>
  );
}
