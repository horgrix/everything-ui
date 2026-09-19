import { useState } from 'react';
import BarChart from '../../components/charts/BarChart';
import MixedChart from '../../components/charts/MixedChart';
import LineChart from '../../components/charts/LineChart';
import PieChart from '../../components/charts/PieChart';
import { formatNumber, formatCompactNumber } from '../../utils/formatters';
import {
  buildAggregateSql,
  buildDetailSql,
  buildSummarySql,
  buildLatestSql,
  buildDailyTrendSql,
  buildMonthlyTrendSql,
  buildTop25Sql,
  buildPcTop25Sql,
  buildCreativeTop25Sql,
  buildDistributionSql,
} from './sql';
import {
  transformAggregate,
  transformDetail,
  transformKpiSnapshot,
  transformDailyTrend,
  transformMonthlyTrend,
  transformTop25,
  transformPcTop25,
  transformCreativeTop25,
  transformDistribution,
} from './transforms';
import { useSqlQuery } from './queries';
import DataTable, { GrowthCell } from './components/DataTable';
import KpiRow from './components/KpiRow';

/** 时间范围快捷选项 */
const TIME_RANGES = [
  { label: '最近1天', days: 1 },
  { label: '最近3天', days: 3 },
  { label: '最近7天', days: 7 },
  { label: '最近15天', days: 15 },
  { label: '最近1个月', days: 30 },
  { label: '最近3个月', days: 90 },
];

// ---- 表格列配置（三张表共用基础列） ----
const idCol = { header: 'AppID', render: (r) => <span className="text-muted small">{r.appId}</span> };
const nameCol = { header: '游戏名称', render: (r) => <span className="fw-semibold">{r.appName}</span> };
const countCol = (header) => ({ header, align: 'end', render: (r) => <span className="fw-semibold">{formatNumber(r.downloadCount)}</span> });
const growthCol = { header: '增长', align: 'end', render: (r) => <GrowthCell value={r.downloadGrowth} /> };
const growthRateCol = { header: '增长率', align: 'end', render: (r) => <GrowthCell value={r.growthRate} percent /> };
const timeCol = { header: '时间', render: (r) => <span className="text-muted small">{r.crawledAt}</span> };

/** 下载Top25明细（主表，含 PC下载数 / PC占比） */
const TOP25_COLUMNS = [
  idCol,
  nameCol,
  countCol('下载数'),
  { header: 'PC下载数', align: 'end', render: (r) => formatNumber(r.pcDownloadCount) },
  { header: 'PC占比', align: 'end', render: (r) => (r.pcRatio != null ? `${r.pcRatio}%` : '-') },
  growthCol,
  growthRateCol,
  timeCol,
];

const PC_TOP25_COLUMNS = [idCol, nameCol, countCol('PC下载数'), growthCol, growthRateCol, timeCol];
const CREATIVE_TOP25_COLUMNS = [idCol, nameCol, countCol('下载数'), growthCol, growthRateCol, timeCol];

export default function TapTapReport() {
  const [appId, setAppId] = useState('');
  const [days, setDays] = useState(1);
  const validAppId = /^\d+$/.test(appId);

  const hotListQuery = useSqlQuery('taptap-hot-list-trend', buildAggregateSql, [], transformAggregate);
  const detailQuery = useSqlQuery('taptap-game-detail', () => buildDetailSql(appId, days), [appId, days], transformDetail, { enabled: validAppId });
  const summaryQuery = useSqlQuery('taptap-game-summary', () => buildSummarySql(appId, days), [appId, days], transformKpiSnapshot, { enabled: validAppId });
  const latestQuery = useSqlQuery('taptap-game-latest', () => buildLatestSql(appId), [appId], transformKpiSnapshot, { enabled: validAppId });
  const dailyTrendQuery = useSqlQuery('taptap-daily-trend', buildDailyTrendSql, [], transformDailyTrend);
  const monthlyTrendQuery = useSqlQuery('taptap-monthly-trend', buildMonthlyTrendSql, [], transformMonthlyTrend);
  const top25Query = useSqlQuery('taptap-top25-list', buildTop25Sql, [], transformTop25);
  const pcTop25Query = useSqlQuery('taptap-pc-top25-list', buildPcTop25Sql, [], transformPcTop25);
  const creativeTop25Query = useSqlQuery('taptap-creative-top25-list', buildCreativeTop25Sql, [], transformCreativeTop25);
  const distributionQuery = useSqlQuery('taptap-game-distribution', buildDistributionSql, [], transformDistribution);

  const detailEmpty = !validAppId || (detailQuery.isSuccess && !detailQuery.data?.series?.length);

  return (
    <div className="container-fluid p-4">
      <h2 className="fw-bold mb-4">
        <i className="bi bi-controller text-primary me-2"></i>
        TapTap 报表
      </h2>

      {/* 热门游戏TopN下载趋势（聚合） */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-0 fw-semibold">热门游戏TopN下载趋势 — 近48小时（增量）</div>
        <div className="card-body">
          <BarChart
            series={hotListQuery.data?.series || []}
            loading={hotListQuery.isLoading}
            error={hotListQuery.error?.message}
            height={675}
            stacked
            totalLabels
            xaxisOverrides={hotListQuery.data?.categories ? { categories: hotListQuery.data.categories, labels: { rotate: -45 } } : {}}
            yaxisOverrides={{
              title: { text: '增量下载数' },
              labels: {
                formatter: (v) => formatCompactNumber(v),
              },
            }} />
        </div>
      </div>

      {/* 热门游戏TopN下载月趋势 + 日趋势 */}
      <div className="row g-3 mb-4">
        {/* 月趋势（左） */}
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">热门游戏TopN下载月趋势 — 最近3个月</div>
            <div className="card-body">
              <BarChart
                series={monthlyTrendQuery.data?.series || []}
                loading={monthlyTrendQuery.isLoading}
                error={monthlyTrendQuery.error?.message}
                height={350}
                stacked
                totalLabels
                xaxisOverrides={monthlyTrendQuery.data?.categories ? { categories: monthlyTrendQuery.data.categories, labels: { rotate: -45 } } : {}}
                yaxisOverrides={{ title: { text: '下载数' }, labels: { formatter: (v) => formatCompactNumber(v) } }} />
            </div>
          </div>
        </div>
        {/* 日趋势（右） */}
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">热门游戏TopN下载日趋势 — 最近15天</div>
            <div className="card-body">
              <LineChart
                series={dailyTrendQuery.data?.series || []}
                loading={dailyTrendQuery.isLoading}
                error={dailyTrendQuery.error?.message}
                height={350}
                strokeWidth={2}
                strokeDashArray={[0, 5, 5]}
                markers={0}
                xaxisOverrides={{ type: 'category', labels: { rotate: -45 } }}
                yaxisOverrides={{ title: { text: '下载数' }, labels: { formatter: (v) => formatCompactNumber(v) } }} />
            </div>
          </div>
        </div>
      </div>

      {/* 追踪的游戏分布 + 下载Top25明细（并排） */}
      <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
        {/* 追踪的游戏分布（20%） */}
        <div style={{ flex: '0 0 20%', minWidth: 240 }}>
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">追踪的游戏分布 — 最近8小时</div>
            <div className="card-body d-flex flex-column align-items-center justify-content-center">
              <PieChart
                series={distributionQuery.data?.series || []}
                labels={distributionQuery.data?.labels || []}
                loading={distributionQuery.isLoading}
                error={distributionQuery.error?.message}
                height={320}
                donut
                totalLabel="总游戏数"
              />
            </div>
          </div>
        </div>

        {/* 下载Top25明细（80%） */}
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">下载Top25明细 — 最近8小时</div>
            <DataTable rows={top25Query.data?.rows || []} columns={TOP25_COLUMNS} />
          </div>
        </div>
      </div>

      {/* PC下载Top25明细 + 创意工坊下载Top25明细（并排） */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">PC下载Top25明细 — 最近8小时</div>
            <DataTable rows={pcTop25Query.data?.rows || []} columns={PC_TOP25_COLUMNS} />
          </div>
        </div>
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">创意工坊下载Top25明细 — 最近8小时</div>
            <DataTable rows={creativeTop25Query.data?.rows || []} columns={CREATIVE_TOP25_COLUMNS} />
          </div>
        </div>
      </div>

      {/* 查询条件（独立模块） */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-0 fw-semibold">查询条件</div>
        <div className="card-body">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <label className="form-label small text-muted mb-0">AppID</label>
            <input
              type="text"
              className="form-control form-control-sm"
              style={{ width: 180 }}
              placeholder="请输入appId"
              value={appId}
              onChange={(e) => setAppId(e.target.value.trim())}
            />
            <span className="ms-3 text-muted small">时间范围</span>
            {TIME_RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                className={`btn btn-sm ${days === r.days ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setDays(r.days)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 游戏汇总指标（受查询条件控制） */}
      <KpiRow data={summaryQuery.data} />

      {/* 游戏最新快照指标（历史累计值） */}
      <KpiRow data={latestQuery.data} suffix="(历史)" />

      {/* 游戏详情趋势（受查询条件控制） */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-0 fw-semibold">
          游戏详情趋势{detailQuery.data?.appName ? ` — ${detailQuery.data.appName}` : ''}
        </div>
        <div className="card-body">
          {detailEmpty ? (
            <div className="text-center text-muted py-5">
              <i className="bi bi-inbox fs-1 d-block mb-2"></i>
              暂无数据
            </div>
          ) : (
            <MixedChart
              series={detailQuery.data?.series || []}
              loading={detailQuery.isLoading}
              error={detailQuery.error?.message}
              height={400}
              toolbar={false}
              colors={['#4361ee', '#e71d36']}
              strokeWidths={[0, 2]}
              tooltipY={(v, yi) => (yi === 1 ? v.toFixed(2) + '%' : v.toLocaleString('zh-CN'))}
              xaxisOverrides={{ type: 'category', labels: { rotate: -45 } }}
              yaxisLeft={{ title: { text: '总下载数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
              yaxisRight={{ title: { text: 'PC下载数占比 (%)' }, min: 0, max: 100, labels: { formatter: (v) => v.toFixed(2) + '%' } }} />
          )}
        </div>
      </div>
    </div>
  );
}
