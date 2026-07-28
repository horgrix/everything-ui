import { useState, useMemo } from 'react';
import useChartData from '../../hooks/useChartData';
import { fetchCoreFinancialReport, fetchBalanceReport, fetchExpenseReport, fetchOperationalReport, fetchRevenueReport, fetchRevenueGameReport } from '../../api/financial';
import DashboardCard from '../../components/layout/DashboardCard';
import BarChart from '../../components/charts/BarChart';
import LineChart from '../../components/charts/LineChart';
import MixedChart from '../../components/charts/MixedChart';
import { formatCurrency } from '../../utils/formatters';

const PERIOD_ORDER = { H1: 0, H2: 1, FY: 2 };

function sortByPeriod(rows) {
  return [...rows].sort((a, b) => {
    if (a.report_year !== b.report_year) return a.report_year - b.report_year;
    return (PERIOD_ORDER[a.period] || 0) - (PERIOD_ORDER[b.period] || 0);
  });
}

function formatAmount(v) {
  const abs = Math.abs(v);
  if (abs >= 1e8) return (v / 1e8).toFixed(1) + '亿';
  if (abs >= 1e4) return (v / 1e4).toFixed(1) + '万';
  return String(v);
}

function fixAmounts(rows, fields) {
  return rows.map((r) => {
    const a = { ...r };
    fields.forEach((f) => { if (a[f] != null) a[f] = Number(a[f]) * 1000; });
    return a;
  });
}

export default function FinanceInfo() {
  const [yearRange, setYearRange] = useState({ start: 2023, end: 2026 });

  // ====== 核心财务 ======
  const finQuery = useChartData(
    'core-financial-report',
    async (p) => { const d = await fetchCoreFinancialReport(p); return { data: d, total: d.length }; },
    { start_year: yearRange.start, end_year: yearRange.end, period: ['H1', 'H2', 'FY'] },
    {
      transform: (rows) => {
        if (!rows || !rows.length) return { kpi: {}, barSeries: [], barCategories: [], lineSeries: [] };
        const adj = fixAmounts(rows, ['revenue', 'gross_profit', 'profit_for_year',
          'profit_attr_to_shareholders', 'adjusted_profit_for_year', 'adjusted_profit_attr_to_shareholders']);
        const sorted = sortByPeriod(adj);
        const categories = sorted.map((r) => `${r.report_year} ${r.period}`);
        const latest = sorted[sorted.length - 1];
        return {
          kpi: {
            revenue: latest.revenue,
            grossProfit: latest.gross_profit,
            grossProfitMargin: latest.gross_profit_margin,
            adjustedProfit: latest.adjusted_profit_attr_to_shareholders,
          },
          barCategories: categories,
          barSeries: [
            { name: '营收', data: sorted.map((r) => Number(r.revenue || 0)) },
            { name: '毛利', data: sorted.map((r) => Number(r.gross_profit || 0)) },
            { name: '净利润', data: sorted.map((r) => Number(r.profit_attr_to_shareholders || 0)) },
            { name: '调整后净利润', data: sorted.map((r) => Number(r.adjusted_profit_attr_to_shareholders || 0)) },
          ],
          lineSeries: [
            { name: '毛利率', data: sorted.map((r) => ({ x: `${r.report_year} ${r.period}`, y: Number(r.gross_profit_margin || 0) })) },
            { name: '净利润率', data: sorted.map((r) => ({ x: `${r.report_year} ${r.period}`, y: Number(r.profit_attr_to_shareholders_margin || 0) })) },
            { name: '调整后净利润率', data: sorted.map((r) => ({ x: `${r.report_year} ${r.period}`, y: Number(r.adjusted_profit_attr_to_shareholders_margin || 0) })) },
          ],
        };
      },
    }
  );

  // ====== 资产负债表 ======
  const balQuery = useChartData(
    'balance-report',
    async (p) => { const d = await fetchBalanceReport(p); return { data: d, total: d.length }; },
    { start_year: yearRange.start, end_year: yearRange.end, period: ['H1', 'H2', 'FY'] },
    {
      transform: (rows) => {
        if (!rows || !rows.length) return { categories: [], contractSeries: [], mixedSeries: [] };
        const adj = fixAmounts(rows, ['cash_and_cash_equivalents', 'contract_liabilities', 'total_liabilities']);
        const sorted = sortByPeriod(adj);
        const categories = sorted.map((r) => `${r.report_year} ${r.period}`);
        return {
          categories,
          contractSeries: [{
            name: '合同负债',
            data: sorted.map((r) => ({ x: `${r.report_year} ${r.period}`, y: Number(r.contract_liabilities || 0) })),
          }],
          mixedSeries: [
            { name: '现金及其等价物', type: 'column', yAxisIndex: 0, data: sorted.map((r) => Number(r.cash_and_cash_equivalents || 0)) },
            { name: '总负债', type: 'column', yAxisIndex: 0, data: sorted.map((r) => Number(r.total_liabilities || 0)) },
            { name: '净现金', type: 'line', yAxisIndex: 1, data: sorted.map((r) => (Number(r.cash_and_cash_equivalents || 0) - Number(r.total_liabilities || 0))) },
          ],
        };
      },
    }
  );

  // ====== 费用报告 ======
  const expQuery = useChartData(
    'expense-report',
    async (p) => { const d = await fetchExpenseReport(p); return { data: d, total: d.length }; },
    { start_year: yearRange.start, end_year: yearRange.end, period: ['H1', 'H2', 'FY'] },
    {
      transform: (rows) => {
        if (!rows || !rows.length) return { categories: [], charts: [] };
        const adj = fixAmounts(rows, ['selling_and_marketing_expenses', 'research_and_development_expenses', 'general_and_administrative_expenses', 'revenue']);
        const sorted = sortByPeriod(adj);
        const categories = sorted.map((r) => `${r.report_year} ${r.period}`);

        const totalExpenseData = sorted.map((r) =>
          (Number(r.selling_and_marketing_expenses || 0) +
           Number(r.research_and_development_expenses || 0) +
           Number(r.general_and_administrative_expenses || 0)));
        const totalRatioData = sorted.map((r) => {
          const sum = totalExpenseData[sorted.indexOf(r)];
          return parseFloat(((sum / (Number(r.revenue || 1)) * 100).toFixed(2)));
        });

        const charts = [
          {
            label: '总费用',
            series: [
              { name: '总费用', type: 'column', yAxisIndex: 0, data: totalExpenseData },
              { name: '费用占比', type: 'line', yAxisIndex: 1, data: totalRatioData },
            ],
          },
          {
            label: '销售及营销开支',
            series: [
              { name: '费用', type: 'column', yAxisIndex: 0, data: sorted.map((r) => Number(r.selling_and_marketing_expenses || 0)) },
              { name: '费用占比', type: 'line', yAxisIndex: 1, data: sorted.map((r) => Number(r.selling_and_marketing_expenses_ratio || 0)) },
            ],
          },
          {
            label: '研发开支',
            series: [
              { name: '费用', type: 'column', yAxisIndex: 0, data: sorted.map((r) => Number(r.research_and_development_expenses || 0)) },
              { name: '费用占比', type: 'line', yAxisIndex: 1, data: sorted.map((r) => Number(r.research_and_development_expenses_ratio || 0)) },
            ],
          },
          {
            label: '一般及行政开支',
            series: [
              { name: '费用', type: 'column', yAxisIndex: 0, data: sorted.map((r) => Number(r.general_and_administrative_expenses || 0)) },
              { name: '费用占比', type: 'line', yAxisIndex: 1, data: sorted.map((r) => Number(r.general_and_administrative_expenses_ratio || 0)) },
            ],
          },
        ];
        return { categories, charts };
      },
    }
  );

  const kpi = finQuery.data?.kpi || {};
  const barSeries = finQuery.data?.barSeries || [];
  const barCategories = finQuery.data?.barCategories || [];
  const lineSeries = finQuery.data?.lineSeries || [];
  const contractSeries = balQuery.data?.contractSeries || [];
  const mixedSeries = balQuery.data?.mixedSeries || [];
  const balCategories = balQuery.data?.categories || [];
  const expData = expQuery.data || {};
  const expCharts = expData.charts || [];
  const expCategories = expData.categories || [];

  // ====== 运营数据 ======
  const opsQuery = useChartData(
    'operational-report',
    async (p) => { const d = await fetchOperationalReport(p); return { data: d, total: d.length }; },
    { start_year: yearRange.start, end_year: yearRange.end, period: ['H1', 'H2', 'FY'] },
    {
      transform: (rows) => {
        if (!rows || !rows.length) return { categories: [], series: [] };
        const sorted = sortByPeriod(rows);
        const K = 1000; // 数据单位为千人
        return {
          categories: sorted.map((r) => `${r.report_year} ${r.period}`),
          series: [
            { name: '网络游戏平均MAU', data: sorted.map((r) => Number(r.online_games_mau || 0) * K) },
            { name: '网络游戏平均MPU', data: sorted.map((r) => Number(r.online_games_mpu || 0) * K) },
            { name: '中国版TapTap平均MAU', data: sorted.map((r) => Number(r.taptap_china_app_mau || 0) * K) },
            { name: '国际版TapTap平均MAU', data: sorted.map((r) => Number(r.taptap_international_app_mau || 0) * K) },
          ],
        };
      },
    }
  );

  const opsCategories = opsQuery.data?.categories || [];
  const opsSeries = opsQuery.data?.series || [];

  // ====== 业务收入 ======
  const revQuery = useChartData(
    'revenue-report',
    async (p) => { const d = await fetchRevenueReport(p); return { data: d, total: d.length }; },
    { start_year: yearRange.start, end_year: yearRange.end, period: ['H1', 'H2', 'FY'] },
    {
      transform: (rows) => {
        if (!rows || !rows.length) return { categories: [], shareSeries: [], marginSeries: [] };
        const sorted = sortByPeriod(rows);
        const categories = sorted.map((r) => `${r.report_year} ${r.period}`);

        // 占比柱状图（堆叠百分比）
        const shareSeries = [
          {
            name: '游戏收入',
            data: sorted.map((r) => {
              const game = Number(r.game_revenue || 0);
              const taptap = Number(r.taptap_platform_revenue || 0);
              const total = game + taptap;
              return total > 0 ? parseFloat(((game / total) * 100).toFixed(1)) : 0;
            }),
          },
          {
            name: 'TapTap平台收入',
            data: sorted.map((r) => {
              const game = Number(r.game_revenue || 0);
              const taptap = Number(r.taptap_platform_revenue || 0);
              const total = game + taptap;
              return total > 0 ? parseFloat(((taptap / total) * 100).toFixed(1)) : 0;
            }),
          },
        ];

        // 毛利率趋势图
        const marginSeries = [
          {
            name: '游戏毛利率',
            data: sorted.map((r) => ({ x: `${r.report_year} ${r.period}`, y: Number(r.game_gross_profit_margin || 0) })),
          },
          {
            name: 'TapTap毛利率',
            data: sorted.map((r) => ({ x: `${r.report_year} ${r.period}`, y: Number(r.taptap_platform_gross_profit_margin || 0) })),
          },
        ];

        return { categories, shareSeries, marginSeries };
      },
    }
  );

  const revCategories = revQuery.data?.categories || [];
  const revShareSeries = revQuery.data?.shareSeries || [];
  const revMarginSeries = revQuery.data?.marginSeries || [];

  // ====== 游戏收入分类 ======
  const gameRevQuery = useChartData(
    'revenue-game-report',
    async (p) => { const d = await fetchRevenueGameReport(p); return { data: d, total: d.length }; },
    { start_year: yearRange.start, end_year: yearRange.end, period: ['H1', 'H2', 'FY'] },
    {
      transform: (rows) => {
        if (!rows || !rows.length) return { categories: [], typeSeries: [], basisSeries: [] };
        const adj = fixAmounts(rows, ['online_game_revenue', 'paid_game_revenue', 'other_game_revenue', 'gross_basis_revenue', 'net_basis_revenue']);
        const sorted = sortByPeriod(adj);
        const categories = sorted.map((r) => `${r.report_year} ${r.period}`);
        return {
          categories,
          typeSeries: [
            { name: '网络游戏', data: sorted.map((r) => Number(r.online_game_revenue || 0)) },
            { name: '付费游戏', data: sorted.map((r) => Number(r.paid_game_revenue || 0)) },
            { name: '其他', data: sorted.map((r) => Number(r.other_game_revenue || 0)) },
          ],
          basisSeries: [
            { name: '总额基准', data: sorted.map((r) => Number(r.gross_basis_revenue || 0)) },
            { name: '净额基准', data: sorted.map((r) => Number(r.net_basis_revenue || 0)) },
          ],
        };
      },
    }
  );

  const grvCategories = gameRevQuery.data?.categories || [];
  const grvTypeSeries = gameRevQuery.data?.typeSeries || [];
  const grvBasisSeries = gameRevQuery.data?.basisSeries || [];

  return (
    <div className="container-fluid p-4">
      {/* 标题 + 年份 */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold mb-0"><i className="bi bi-cash-stack text-success me-2"></i>核心财务指标</h2>
        <div className="d-flex align-items-center gap-2">
          <label className="text-muted small">年份范围:</label>
          <select className="form-select form-select-sm" style={{ width: 100 }}
            value={yearRange.start} onChange={(e) => setYearRange((p) => ({ ...p, start: Number(e.target.value) }))}>
            {[2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="text-muted">—</span>
          <select className="form-select form-select-sm" style={{ width: 100 }}
            value={yearRange.end} onChange={(e) => setYearRange((p) => ({ ...p, end: Number(e.target.value) }))}>
            {[2021, 2022, 2023, 2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* KPI 卡片 */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3"><DashboardCard title="营收" value={formatCurrency(kpi.revenue, 0)} icon="bi-graph-up-arrow" color="primary" /></div>
        <div className="col-6 col-md-3"><DashboardCard title="毛利" value={formatCurrency(kpi.grossProfit, 0)} icon="bi-bar-chart" color="success" subtitle={kpi.grossProfitMargin != null ? `毛利率 ${kpi.grossProfitMargin}%` : ''} /></div>
        <div className="col-6 col-md-3"><DashboardCard title="毛利率" value={kpi.grossProfitMargin != null ? `${kpi.grossProfitMargin}%` : '-'} icon="bi-pie-chart" color="info" /></div>
        <div className="col-6 col-md-3"><DashboardCard title="调整后净利润" value={formatCurrency(kpi.adjustedProfit, 0)} icon="bi-cash-coin" color="warning" /></div>
      </div>

      {/* 财务指标 + 利润率 */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">财务指标</div>
            <div className="card-body">
              <BarChart series={barSeries} loading={finQuery.isLoading} error={finQuery.error?.message} height={400}
                xaxisOverrides={barCategories.length > 0 ? { categories: barCategories } : {}}
                yaxisOverrides={{ labels: { formatter: formatAmount } }} />
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">利润率趋势</div>
            <div className="card-body">
              <LineChart series={lineSeries} loading={finQuery.isLoading} error={finQuery.error?.message} height={400}
                xaxisOverrides={{ type: 'category', labels: { rotate: -45 } }}
                yaxisOverrides={{ title: { text: '比率 (%)' }, labels: { formatter: (v) => v.toFixed(0) + '%' } }}
                strokeWidth={2} markers={4} />
            </div>
          </div>
        </div>
      </div>

      {/* 资产负债表 */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">合同负债</div>
            <div className="card-body">
              <LineChart series={contractSeries} loading={balQuery.isLoading} error={balQuery.error?.message} height={400} currency
                xaxisOverrides={{ type: 'category', labels: { rotate: -45 } }}
                yaxisOverrides={{ title: { text: '金额' } }} strokeWidth={2} markers={4} />
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">现金及其等价物</div>
            <div className="card-body">
              <MixedChart series={mixedSeries} loading={balQuery.isLoading} error={balQuery.error?.message} height={400}
                colors={['#4361ee', '#e71d36', '#2ec4b6']} strokeWidths={[0, 0, 2]}
                tooltipY={(v, yi) => yi === 1 ? formatAmount(v) : formatAmount(v)}
                xaxisOverrides={balCategories.length > 0 ? { categories: balCategories, type: 'category', labels: { rotate: -45 } } : {}}
                yaxisLeft={{ title: { text: '金额' }, labels: { formatter: formatAmount } }}
                yaxisRight={{ title: { text: '净现金' }, labels: { formatter: formatAmount } }} />
            </div>
          </div>
        </div>
      </div>

      {/* 费用报告 — 4列 */}
      {expCharts.length > 0 && (
        <div className="row g-3 mb-4">
          {expCharts.map((item) => (
            <div key={item.label} className="col-12 col-md-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-0 fw-semibold small">{item.label}</div>
                <div className="card-body p-2">
                  <MixedChart series={item.series} loading={expQuery.isLoading} error={expQuery.error?.message} height={300}
                    colors={['#4361ee', '#e71d36']} strokeWidths={[0, 2]}
                    tooltipY={(v, yi) => yi === 1 ? v.toFixed(2) + '%' : formatAmount(v)}
                    xaxisOverrides={expCategories.length > 0 ? { categories: expCategories, type: 'category', labels: { rotate: -90, style: { fontSize: '9px' } } } : {}}
                    yaxisLeft={{ title: { text: '费用' }, labels: { formatter: formatAmount } }}
                    yaxisRight={{ title: { text: '%' }, labels: { formatter: (v) => v.toFixed(1) + '%' } }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 运营数据 — 柱状图 */}
      <div className="row g-3 mb-4">
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 fw-semibold">运营数据 — MAU / MPU</div>
            <div className="card-body">
              <BarChart series={opsSeries} loading={opsQuery.isLoading} error={opsQuery.error?.message} height={400}
                xaxisOverrides={opsCategories.length > 0 ? { categories: opsCategories } : {}}
                yaxisOverrides={{
                  labels: {
                    formatter: (v) => {
                      if (Math.abs(v) >= 10000) return (v / 10000).toFixed(1) + '万';
                      if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + 'k';
                      return v;
                    },
                  },
                }} />
            </div>
          </div>
        </div>
      </div>

      {/* 业务收入 — 占比 + 毛利率 */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">业务收入占比</div>
            <div className="card-body">
              <BarChart series={revShareSeries} loading={revQuery.isLoading} error={revQuery.error?.message} height={400}
                stacked
                xaxisOverrides={revCategories.length > 0 ? { categories: revCategories } : {}}
                yaxisOverrides={{
                  max: 100,
                  labels: { formatter: (v) => v + '%' },
                }} />
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">业务毛利率趋势</div>
            <div className="card-body">
              <LineChart series={revMarginSeries} loading={revQuery.isLoading} error={revQuery.error?.message} height={400}
                xaxisOverrides={{ type: 'category', labels: { rotate: -45 } }}
                yaxisOverrides={{ title: { text: '比率 (%)' }, labels: { formatter: (v) => v.toFixed(0) + '%' } }}
                strokeWidth={2} markers={4} />
            </div>
          </div>
        </div>
      </div>

      {/* 游戏收入分类 — 按收入类型 + 按确认方式 */}
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">游戏业务按收入分类</div>
            <div className="card-body">
              <BarChart series={grvTypeSeries} loading={gameRevQuery.isLoading} error={gameRevQuery.error?.message} height={400}
                stacked
                xaxisOverrides={grvCategories.length > 0 ? { categories: grvCategories } : {}}
                yaxisOverrides={{ labels: { formatter: formatAmount } }} />
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">游戏业务按收入确认方式分类</div>
            <div className="card-body">
              <BarChart series={grvBasisSeries} loading={gameRevQuery.isLoading} error={gameRevQuery.error?.message} height={400}
                stacked
                xaxisOverrides={grvCategories.length > 0 ? { categories: grvCategories } : {}}
                yaxisOverrides={{ labels: { formatter: formatAmount } }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}