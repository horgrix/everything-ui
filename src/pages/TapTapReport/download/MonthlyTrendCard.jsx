import BarChart from '../../../components/charts/BarChart';
import ChartCard from '../components/ChartCard';
import { formatCompactNumber } from '../../../utils/formatters';
import { MONTHLY_BREAKDOWN_CHARTS, MONTHLY_BREAKDOWN_COLORS } from './constants';

/** 热门游戏TopN下载月趋势卡片（带 totalLabels 的堆叠柱，宽 35%） */
export default function MonthlyBreakdownCard({ chartKey, data, loading, error, updateLabel }) {
  const cfg = MONTHLY_BREAKDOWN_CHARTS.find((c) => c.key === chartKey);
  return (
    <div className="col-12 tt-split-35">
      <ChartCard title={cfg?.title || ''} updateLabel={updateLabel} body>
        <BarChart
            series={data?.[chartKey] || []}
            loading={loading}
            error={error}
            height={350}
            stacked
            colors={MONTHLY_BREAKDOWN_COLORS[chartKey]}
            totalLabels
            shared
            xaxisOverrides={data?.categories ? { categories: data.categories, labels: { rotate: -45 } } : {}}
            yaxisOverrides={{ title: { text: '下载数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
        />
      </ChartCard>
    </div>
  );
}
