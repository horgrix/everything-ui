import BarChart from '../../../components/charts/BarChart';
import ChartCard from '../components/ChartCard';
import { tooltipHtml, tooltipValue } from '../components/tooltipHtml';
import { formatNumber, formatCompactNumber } from '../../../utils/formatters';

/**
 * 追踪游戏下载趋势(游戏类型) — 近 24 小时增量堆叠柱
 * 三个系列：商业游戏 / 独立小游戏 / Maker小游戏（数据源 dws_taptap_download_summary_hourly）
 *
 * 柱子可点击：点某一根 → 把下面「下载Top25明细查询条件」的统计窗口切到该小时，
 * 分布饼图与 Top25 明细随窗口一起刷新。
 *
 * @param {(hour: string) => void} [onSelectHour] 点击柱子回调，参数为 crawled_at（'YYYY-MM-DD HH'）
 */
export default function HourlyTrendSection({ data, loading, error, updateLabel, onSelectHour, activeHour = null }) {
  // 同一小时把所有系列的值 + 合计一起列出
  const tooltipCustom = ({ series, dataPointIndex }) => {
    const values = (series || []).map((arr) => Number(arr?.[dataPointIndex] ?? 0));
    const total = values.reduce((a, b) => a + (Number.isNaN(b) ? 0 : b), 0);
    return tooltipHtml({
      title: data?.categories?.[dataPointIndex] ?? '',
      minWidth: 200,
      rows: (data?.series || []).map((sr, i) => ({
        name: sr.name,
        color: sr.color,
        value: tooltipValue(values[i], formatNumber),
      })),
      total: { name: '合计', color: '#A7B0B8', value: formatNumber(total) },
    });
  };

  return (
    <div className="mb-4">
      <ChartCard title="追踪游戏下载趋势(游戏类型) — 近24小时（增量）" updateLabel={updateLabel} body>
        <BarChart
          series={data?.series || []}
          loading={loading}
          error={error}
          height={675}
          stacked
          totalLabels
          columnWidth="45%"
          colors={['#8FA3B0', '#B08B8B', '#9B93A8']}
          tooltipCustom={tooltipCustom}
          xaxisOverrides={data?.categories ? { type: 'category', categories: data.categories, labels: { rotate: -45 } } : {}}
          yaxisOverrides={{ title: { text: '增量下载数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
          events={
            onSelectHour
              ? {
                  dataPointSelection: (_event, _chartContext, config) => {
                    const hour = data?.categories?.[config?.dataPointIndex];
                    if (hour) onSelectHour(hour);
                  },
                }
              : {}
          }
        />
        {onSelectHour && (
          <div className="text-muted small mt-2">
            <i className="bi bi-hand-index-thumb me-1" />
            点任意柱子可把下方「统计窗口」切到该小时（分布饼图与 Top25 明细一并刷新）
            {activeHour ? `；当前查看：${activeHour}` : ''}
          </div>
        )}
      </ChartCard>
    </div>
  );
}
