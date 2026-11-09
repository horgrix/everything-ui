import LineChart from '../../../components/charts/LineChart';
import ChartCard from '../components/ChartCard';
import ChartNotice from '../components/ChartNotice';
import { tooltipHtml, tooltipValue } from '../components/tooltipHtml';
import { formatNumber, formatCompactNumber } from '../../../utils/formatters';
import { WEEKLY_TREND_CHARTS } from './constants';

/** 热门游戏TopN下载日趋势卡片（上周 vs 本周，本周加粗实线、上周虚线，占剩余 65%） */
export default function WeeklyTrendCard({ chartKey, data, loading, error, updateLabel, notice, realtime }) {
  const cfg = WEEKLY_TREND_CHARTS[chartKey];
  const categories = data?.categories || [];
  // 数据点用 [x=0~6, y] 数值对，缺数据的日期直接不画点（参照【广告大盘】日趋势的做法）。
  // category 轴 + 含 null 的数组会让 Apex 把「折线几何」和「轴标签」算成两套间距，导致整体右偏。
  const toPairs = (arr) => (arr || []).map((v, i) => (v == null ? null : [i, Number(v)])).filter(Boolean);
  const series = [];
  const colorList = [];
  const rt = realtime && realtime.weekdayIdx != null ? realtime : null;
  cfg.pairs(data).forEach(([cur, prev], i) => {
    // 今天这一点的本周值用 SQLite 实时汇总覆盖（MySQL 日表当天数据不完整）
    let current = cur;
    const rtKey = cfg.realtimeKeys?.[i];
    if (rt && rtKey && rt[rtKey] != null) {
      current = (cur || []).slice();
      current[rt.weekdayIdx] = rt[rtKey];
    }
    series.push({ name: `${cfg.names[i]}（本周）`, data: toPairs(current) });
    series.push({ name: `${cfg.names[i]}（上周）`, data: toPairs(prev) });
    colorList.push(cfg.colors[i], cfg.colors[i]);
  });

  // 自定义 tooltip：同一个 x（周几）下把所有系列的值都列出来。
  // Apex 默认在鼠标压到某个点/某条线上时只显示当前系列，这里统一成整列读数。
  const tooltipCustom = ({ series: rawSeries, dataPointIndex }) => {
    const valueAt = (arr, idx) => {
      const p = arr?.[idx];
      if (Array.isArray(p)) return p[1];
      if (p && typeof p === 'object') return p.y;
      return p;
    };
    const firstPoint = rawSeries?.[0]?.[dataPointIndex];
    const xValue = Array.isArray(firstPoint) ? firstPoint[0] : dataPointIndex;
    const xLabel = categories[Math.round(xValue)] ?? '';
    return tooltipHtml({
      title: xLabel,
      minWidth: 210,
      rows: series.map((s, i) => ({
        name: s.name,
        color: colorList[i],
        value: tooltipValue(valueAt(rawSeries?.[i], dataPointIndex), formatNumber),
      })),
    });
  };

  const realtimeNote = rt
    ? `今日（${categories[rt.weekdayIdx] || '今天'}）为实时数据，截至 ${String(rt.latestHour).slice(11)}:00`
    : null;

  return (
    <div className="col-12 tt-split-65">
      <ChartCard
        title={cfg.title}
        subtitle={realtimeNote}
        updateLabel={updateLabel}
        notice={notice ? <ChartNotice compact>{notice}</ChartNotice> : null}
        body
      >
          <LineChart
            series={series}
            loading={loading}
            error={error}
            height={350}
            toolbar={false}
            strokeWidth={[3, 1.8, 3, 1.8]}
            strokeDashArray={[0, 5, 0, 5]}
            colors={colorList}
            // 与【广告大盘】日趋势一致：markers size 6 → 常态直径 12px，hover 12 → 悬停直径 24px
            markers={{ size: 6, hover: { size: 12 } }}
            tooltipCustom={tooltipCustom}
            shared
            legendOverrides={{ fontSize: '9px' }}
            // 数值轴：0~6 对应周一到周日，点和标签共用同一套坐标，不会错位
            xaxisOverrides={{
              type: 'numeric',
              min: 0,
              max: 6,
              tickAmount: 6,
              labels: { rotate: 0, formatter: (v) => categories[Math.round(v)] ?? '' },
            }}
            yaxisOverrides={{ title: { text: '下载数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
          />
      </ChartCard>
    </div>
  );
}
