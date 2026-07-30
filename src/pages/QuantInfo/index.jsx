import { useState, useMemo, useEffect, useCallback } from 'react';
import useChartData from '../../hooks/useChartData';
import { fetchIndicators, runStrategy, fetchStrategyList } from '../../api/quant';
import query from '../../api/query';
import DashboardCard from '../../components/layout/DashboardCard';
import CandlestickChart from '../../components/charts/CandlestickChart';
import LineChart from '../../components/charts/LineChart';
import MixedChart from '../../components/charts/MixedChart';
import { formatNumber, formatCurrency } from '../../utils/formatters';

const today = new Date().toISOString().slice(0, 10);
const oneYearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);

export default function QuantInfo() {
  const [code, setCode] = useState('02400');
  const [market, setMarket] = useState('HK');
  const [startDate, setStartDate] = useState(oneYearAgo);
  const [endDate, setEndDate] = useState(today);

  const [strategy, setStrategy] = useState('sma_cross');
  const [strategyParamValues, setStrategyParamValues] = useState({});
  const [initialCash, setInitialCash] = useState(100000);

  // 策略列表
  const [strategyList, setStrategyList] = useState([]);
  useEffect(() => {
    fetchStrategyList().then((res) => {
      const list = res?.data || [];
      setStrategyList(list);
      // 初始化第一个策略的参数
      const first = list.find((s) => s.name === strategy) || list[0];
      if (first && first.params) {
        const vals = {};
        Object.entries(first.params).forEach(([k, v]) => { vals[k] = v; });
        setStrategyParamValues(vals);
      }
    }).catch(() => {});
  }, []);

  // 切换策略时重置参数
  const selectedStrategyDef = strategyList.find((s) => s.name === strategy) || {};
  const selectedParams = selectedStrategyDef.params || {};

  // 动态构建 strategyParams
  const dynamicStrategyParams = useMemo(() => {
    const params = {};
    Object.keys(selectedParams).forEach((k) => { params[k] = strategyParamValues[k] ?? selectedParams[k]; });
    return JSON.stringify(params);
  }, [selectedParams, strategyParamValues]);

  const [tradesPage, setTradesPage] = useState(1);
  const PAGE_SIZE = 10;

  // ====== 指标 + K线 ======
  const indicatorParams = useMemo(() => ({
    code,
    startDate,
    endDate,
    indicators: 'adx,chop,sma,psar',
    params: JSON.stringify({ sma: { length: 200 } }),
  }), [code, startDate, endDate]);

  const indicatorQuery = useChartData(
    'indicator',
    async (p) => { const b = await fetchIndicators(p); return { data: b.data || [], total: b.count }; },
    indicatorParams,
    {
      transform: (rows) => {
        if (!rows || rows.length === 0) return { kpi: {}, klineSeries: [], adxSeries: [], chopSeries: [], psarSeries: [] };
        const sorted = [...rows].sort((a, b) => new Date(a.date) - new Date(b.date));
        const first = sorted[0], latest = sorted[sorted.length - 1];

        // KPI
        const kpi = {
          latestPrice: Number(latest.close),
          change: ((Number(latest.close) - Number(first.open)) / Number(first.open) * 100),
          high: Math.max(...sorted.map((r) => Number(r.high))),
          low: Math.min(...sorted.map((r) => Number(r.low))),
          avgVolume: Math.round(sorted.reduce((s, r) => s + Number(r.volume || 0), 0) / sorted.length),
        };

        // K线 series
        const klineSeries = [{
          name: `${code}.${market}`,
          data: sorted.map((r) => ({ x: r.date, y: [Number(r.open), Number(r.high), Number(r.low), Number(r.close)] })),
        }];

        // ADX
        const adxSeries = [
          { name: 'ADX', data: sorted.map((r) => ({ x: r.date, y: r.indicators?.ADX_14 ?? null })) },
          { name: 'DMP', data: sorted.map((r) => ({ x: r.date, y: r.indicators?.DMP_14 ?? null })) },
          { name: 'DMN', data: sorted.map((r) => ({ x: r.date, y: r.indicators?.DMN_14 ?? null })) },
        ];

        // CHOP
        const chopSeries = [
          { name: 'CHOP', data: sorted.map((r) => ({ x: r.date, y: r.indicators?.['CHOP_14_1_100.0'] ?? null })) },
        ];

        // PSAR (stepline)
        const psarSeries = [
          { name: 'PSAR Long', data: sorted.map((r) => ({ x: r.date, y: r.indicators?.['PSARl_0.02_0.2'] ?? null })) },
          { name: 'PSAR Short', data: sorted.map((r) => ({ x: r.date, y: r.indicators?.['PSARs_0.02_0.2'] ?? null })) },
        ];

        return { kpi, klineSeries, adxSeries, chopSeries, psarSeries };
      },
    }
  );

  // ====== 回购趋势 ======
  const buybackWhere = useMemo(() => [
    { col: 'code', op: '=', value: code },
    { col: 'stat_date', op: '>=', value: startDate },
    { col: 'stat_date', op: '<=', value: endDate },
  ], [code, startDate, endDate]);

  const buybackQuery = useChartData(
    'hk-stock-buyback-daily',
    (p) => query('hk_stock_buyback_daily', p),
    { fields: 'stat_date,volume,avg_price', where: buybackWhere, order_by: 'stat_date ASC', limit: 9999 },
    {
      transform: (rows) => {
        if (!rows || !rows.length) return { series: [], summary: null };
        const sorted = [...rows].sort((a, b) => a.stat_date < b.stat_date ? -1 : 1);
        let totalVolume = 0, totalAmt = 0;
        for (const r of sorted) {
          const vol = Number(r.volume || 0);
          const price = Number(r.avg_price || 0);
          totalVolume += vol;
          totalAmt += vol * price;
        }
        return {
          series: [
            { name: '回购数量', type: 'column', yAxisIndex: 0, data: sorted.map((r) => ({ x: r.stat_date, y: Number(r.volume || 0) })) },
            { name: '回购均价', type: 'line', yAxisIndex: 1, data: sorted.map((r) => ({ x: r.stat_date, y: Number(r.avg_price || 0) })) },
          ],
          summary: { totalVolume, totalAmt, avgPrice: totalVolume > 0 ? totalAmt / totalVolume : 0 },
        };
      },
    }
  );

  // ====== 做空趋势 ======
  const shortSellingQuery = useChartData(
    'hk-stock-short-selling-daily',
    (p) => query('hk_stock_short_selling_daily', p),
    { fields: 'stat_date,volume,avg_price,amt_hkd,trade_amt_hkd', where: buybackWhere, order_by: 'stat_date ASC', limit: 9999 },
    {
      transform: (rows) => {
        if (!rows || !rows.length) return { series: [], summary: null };
        const sorted = [...rows].sort((a, b) => a.stat_date < b.stat_date ? -1 : 1);
        let totalVolume = 0, totalAmt = 0;
        for (const r of sorted) {
          const vol = Number(r.volume || 0);
          totalVolume += vol;
          totalAmt += vol * Number(r.avg_price || 0);
        }
        return {
          series: [
            { name: '做空数量', type: 'column', yAxisIndex: 0, data: sorted.map((r) => ({ x: r.stat_date, y: Number(r.volume || 0) })) },
            { name: '做空率', type: 'line', yAxisIndex: 1, data: sorted.map((r) => {
              const trade = Number(r.trade_amt_hkd || 0);
              return { x: r.stat_date, y: trade > 0 ? parseFloat((Number(r.amt_hkd || 0) / trade * 100).toFixed(2)) : null };
            }) },
          ],
          summary: { totalVolume, totalAmt, avgPrice: totalVolume > 0 ? totalAmt / totalVolume : 0 },
        };
      },
    }
  );

  // ====== 香港银行间流动性 ======
  const liquidityWhere = useMemo(() => [
    { col: 'end_of_date', op: '>=', value: startDate },
    { col: 'end_of_date', op: '<=', value: endDate },
  ], [startDate, endDate]);

  const liquidityQuery = useChartData(
    'hk-market-liquidity-daily',
    (p) => query('hk_market_liquidity_daily', p),
    { fields: 'end_of_date,disc_win_base_rate,hibor_overnight,hibor_fixing_1m', where: liquidityWhere, order_by: 'end_of_date ASC', limit: 9999 },
    {
      transform: (rows) => {
        if (!rows || !rows.length) return { series: [] };
        const sorted = [...rows].sort((a, b) => a.end_of_date < b.end_of_date ? -1 : 1);
        return {
          series: [
            { name: '贴现率', data: sorted.map((r) => ({ x: r.end_of_date, y: Number(r.disc_win_base_rate || 0) })) },
            { name: '隔夜HIBOR', data: sorted.map((r) => ({ x: r.end_of_date, y: Number(r.hibor_overnight || 0) })) },
            { name: '1月HIBOR', data: sorted.map((r) => ({ x: r.end_of_date, y: Number(r.hibor_fixing_1m || 0) })) },
          ],
        };
      },
    }
  );

  // ====== 香港市场大盘做空率 ======
  const exchangeShortQuery = useChartData(
    'hk-exchange-short-selling-daily',
    (p) => query('hk_exchange_short_selling_daily', p),
    { fields: 'total_turnover_hkd,all_ss_percentage,ex_exchange_traded_products_ss_percentage,exchange_traded_products_only_ss_percentage,crawled_at', order_by: 'crawled_at DESC', limit: 1 },
    {
      transform: (rows) => {
        if (!rows || !rows.length) return null;
        return rows[0];
      },
    }
  );

  // ====== 策略回测 ======
  const strategyParams = useMemo(() => ({
    code, startDate, endDate, strategy,
    strategyParams: dynamicStrategyParams,
    initialCash,
  }), [code, startDate, endDate, strategy, dynamicStrategyParams, initialCash]);

  const strategyQuery = useChartData(
    'strategy',
    async (p) => { const b = await runStrategy(p); return { data: b.data ? [b.data] : [], total: 1 }; },
    strategyParams,
    {
      transform: (wrapped) => {
        const result = wrapped?.[0];
        if (!result) return {};
        const m = result.metrics || {};
        const ec = result.equity_curve || [];
        return {
          annotations: {
            xaxis: (result.signals || []).map((s) => ({
              x: new Date(s.date).getTime(),
              label: { text: s.type === 'BUY' ? 'B' : 'S', style: { color: '#fff', background: s.type === 'BUY' ? '#2ec4b6' : '#e71d36' } },
            })),
          },
          trades: result.trades || [],
          summary: { initialCash: m.initial_cash, finalEquity: m.final_equity, totalReturnPct: m.total_return_pct, totalTrades: m.total_trades, sharpeRatio: m.sharpe_ratio, calmarRatio: m.calmar_ratio, maxDrawdownPct: m.max_drawdown_pct },
          equitySeries: [
            { name: '策略净值', data: ec.map((d) => ({ x: d.date, y: Number(d.equity) })) },
            { name: '基准净值', data: ec.map((d) => ({ x: d.date, y: Number(d.benchmark_equity) })) },
          ],
          drawdownSeries: [{ name: '回撤', data: ec.map((d) => ({ x: d.date, y: Number(d.drawdown_pct || 0) })) }],
        };
      },
    }
  );

  const kpi = indicatorQuery.data?.kpi || {};
  const klineSeries = indicatorQuery.data?.klineSeries || [];
  const adxSeries = indicatorQuery.data?.adxSeries || [];
  const chopSeries = indicatorQuery.data?.chopSeries || [];
  const psarSeries = indicatorQuery.data?.psarSeries || [];
  const annotations = strategyQuery.data?.annotations || null;
  const summary = strategyQuery.data?.summary || {};
  const trades = strategyQuery.data?.trades || [];
  const equitySeries = strategyQuery.data?.equitySeries || [];
  const drawdownSeries = strategyQuery.data?.drawdownSeries || [];
  const totalPages = Math.ceil(trades.length / PAGE_SIZE);
  const pagedTrades = trades.slice((tradesPage - 1) * PAGE_SIZE, tradesPage * PAGE_SIZE);

  return (
    <div className="container-fluid p-4">
      <h2 className="fw-bold mb-4"><i className="bi bi-calculator text-warning me-2"></i>量化信息</h2>

      {/* 筛选 */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-auto"><label className="form-label small text-muted mb-1">股票代码</label>
              <input type="text" className="form-control form-control-sm" style={{ width: 120 }} value={code} onChange={(e) => setCode(e.target.value.trim())} />
            </div>
            <div className="col-auto"><label className="form-label small text-muted mb-1">市场</label>
              <select className="form-select form-select-sm" style={{ width: 100 }} value={market} onChange={(e) => setMarket(e.target.value)}>
                <option value="HK">HK</option><option value="US">US</option><option value="CN">CN</option><option value="JP">JP</option>
              </select>
            </div>
            <div className="col-auto"><label className="form-label small text-muted mb-1">开始日期</label>
              <input type="date" className="form-control form-control-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="col-auto"><label className="form-label small text-muted mb-1">结束日期</label>
              <input type="date" className="form-control form-control-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="col-auto ms-auto"><small className="text-muted">指标: ADX · CHOP · PSAR · SMA_200</small></div>
          </div>
        </div>
      </div>

      {/* 回购 + 做空趋势 */}
      <div className="row g-3 mb-4">
        {/* 回购趋势 */}
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold d-flex justify-content-between align-items-center">
              <span>回购趋势</span>
              {buybackQuery.data?.summary && (
                <div className="d-flex gap-3 small">
                  <span className="fw-semibold">总回购数量: {buybackQuery.data.summary.totalVolume.toLocaleString('zh-CN')}</span>
                  <span className="fw-semibold">总回购金额: {(buybackQuery.data.summary.totalAmt / 1e8).toFixed(2)}亿</span>
                  <span className="fw-semibold">均价: {buybackQuery.data.summary.avgPrice.toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="card-body">
              <MixedChart
                series={buybackQuery.data?.series || []}
                loading={buybackQuery.isLoading}
                error={buybackQuery.error?.message}
                height={350}
                toolbar={false}
                colors={['#4361ee', '#e71d36']}
                strokeWidths={[0, 2]}
                tooltipY={(v, yi) => yi === 1 ? v.toFixed(2) : v.toLocaleString('zh-CN')}
                xaxisOverrides={{ type: 'datetime', labels: { format: 'MM/dd', datetimeUTC: false } }}
                yaxisLeft={{ title: { text: '回购数量' }, labels: { formatter: (v) => v >= 10000 ? (v / 10000).toFixed(1) + '万' : v } }}
                yaxisRight={{ title: { text: '回购均价' }, labels: { formatter: (v) => v.toFixed(1) } }} />
            </div>
          </div>
        </div>
        {/* 做空趋势 */}
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold d-flex justify-content-between align-items-center">
              <span>做空趋势</span>
              {shortSellingQuery.data?.summary && (
                <div className="d-flex gap-3 small">
                  <span className="fw-semibold">总做空数量: {shortSellingQuery.data.summary.totalVolume.toLocaleString('zh-CN')}</span>
                  <span className="fw-semibold">总做空金额: {(shortSellingQuery.data.summary.totalAmt / 1e8).toFixed(2)}亿</span>
                  <span className="fw-semibold">均价: {shortSellingQuery.data.summary.avgPrice.toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="card-body">
              <MixedChart
                series={shortSellingQuery.data?.series || []}
                loading={shortSellingQuery.isLoading}
                error={shortSellingQuery.error?.message}
                height={350}
                toolbar={false}
                colors={['#4361ee', '#e71d36']}
                strokeWidths={[0, 2]}
                xaxisOverrides={{ type: 'datetime', labels: { format: 'MM/dd', datetimeUTC: false } }}
                yaxisLeft={{ title: { text: '做空数量' }, labels: { formatter: (v) => v >= 10000 ? (v / 10000).toFixed(1) + '万' : v } }}
                yaxisRight={{ title: { text: '做空率 (%)' }, labels: { formatter: (v) => v.toFixed(1) + '%' } }} />
            </div>
          </div>
        </div>
      </div>

      {/* 香港银行间流动性 + 大盘做空率 */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-9">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">香港银行间流动性</div>
            <div className="card-body">
              <LineChart
                series={liquidityQuery.data?.series || []}
                loading={liquidityQuery.isLoading}
                error={liquidityQuery.error?.message}
                height={350}
                strokeWidth={2}
                markers={3}
                xaxisOverrides={{ type: 'datetime', labels: { format: 'MM/dd', datetimeUTC: false } }}
                yaxisOverrides={{ title: { text: '利率 (%)' }, labels: { formatter: (v) => v.toFixed(2) + '%' } }} />
            </div>
          </div>
        </div>
        <div className="col-12 col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">大盘做空率</div>
            <div className="card-body d-flex flex-column justify-content-center text-center">
              {exchangeShortQuery.data ? (() => {
                const d = exchangeShortQuery.data;
                const ssPct = parseFloat(d.all_ss_percentage) || 0;
                const isHigh = ssPct > 20;
                return (
                  <div>
                    <p className="text-muted small mb-3">
                      <i className="bi bi-clock me-1"></i>截至 {d.crawled_at}
                    </p>
                    <p className="text-muted mb-2">香港市场大盘做空率</p>
                    <div className={`display-5 fw-bold mb-3 ${isHigh ? 'text-danger' : 'text-success'}`}>
                      {d.all_ss_percentage}
                    </div>
                    <div className="d-flex justify-content-center gap-3 small text-muted mb-2">
                      <span>非交易所: <strong>{d.ex_exchange_traded_products_ss_percentage}</strong></span>
                      <span>交易所: <strong>{d.exchange_traded_products_only_ss_percentage}</strong></span>
                    </div>
                    <div className="badge bg-light text-dark">
                      <i className="bi bi-cash me-1"></i>总成交额 {d.total_turnover_hkd}
                    </div>
                  </div>
                );
              })() : (
                <div className="text-center text-muted">
                  {exchangeShortQuery.isLoading ? '加载中...' : exchangeShortQuery.error?.message || '暂无数据'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-2"><DashboardCard title="最新价" value={kpi.latestPrice != null ? kpi.latestPrice.toFixed(3) : '-'} icon="bi-currency-dollar" color="primary" /></div>
        <div className="col-6 col-md-2"><DashboardCard title="涨跌幅" value={kpi.change != null ? `${kpi.change>0?'+':''}${kpi.change.toFixed(2)}%` : '-'} icon="bi-graph-up-arrow" color={kpi.change>0?'success':'danger'} trend={kpi.change>0?'up':'down'} /></div>
        <div className="col-6 col-md-2"><DashboardCard title="最高价" value={kpi.high != null ? kpi.high.toFixed(3) : '-'} icon="bi-arrow-up-circle" color="success" /></div>
        <div className="col-6 col-md-2"><DashboardCard title="最低价" value={kpi.low != null ? kpi.low.toFixed(3) : '-'} icon="bi-arrow-down-circle" color="danger" /></div>
        <div className="col-6 col-md-2"><DashboardCard title="日均成交量" value={kpi.avgVolume != null ? formatNumber(kpi.avgVolume) : '-'} icon="bi-bar-chart" color="info" /></div>
        <div className="col-6 col-md-2"><DashboardCard title="数据条数" value={klineSeries[0]?.data?.length || 0} icon="bi-database" color="secondary" /></div>
      </div>

      {/* K线图（含策略信号标注） */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-0 fw-semibold d-flex justify-content-between align-items-center">
          <span>K线图 — {code}.{market}</span>
          <small className="text-muted">{startDate} ~ {endDate}</small>
        </div>
        <div className="card-body">
          <CandlestickChart series={klineSeries} loading={indicatorQuery.isLoading} error={indicatorQuery.error?.message} height={500} annotations={annotations} chartGroup="quant-group" />
        </div>
      </div>

      {/* 指标图：ADX + CHOP + PSAR */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">ADX 指标</div>
            <div className="card-body">
              <LineChart series={adxSeries} height={300} strokeWidth={2}
                colors={['#f97316', '#22c55e', '#ef4444']}
                xaxisOverrides={{ type: 'datetime', labels: { format: 'MM/dd', datetimeUTC: false } }}
                yaxisAnnotations={[{ y: 25, label: '25', color: '#94a3b8', dash: 2 }, { y: 50, label: '50', color: '#94a3b8', dash: 2 }]}
                chartGroup="quant-group"
                loading={indicatorQuery.isLoading} error={indicatorQuery.error?.message} />
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">CHOP 指标</div>
            <div className="card-body">
              <LineChart series={chopSeries} height={300} strokeWidth={2}
                colors={['#f97316']}
                xaxisOverrides={{ type: 'datetime', labels: { format: 'MM/dd', datetimeUTC: false } }}
                yaxisAnnotations={[{ y: 38.2, label: '38.2', color: '#94a3b8', dash: 2 }, { y: 61.8, label: '61.8', color: '#94a3b8', dash: 2 }]}
                chartGroup="quant-group"
                loading={indicatorQuery.isLoading} error={indicatorQuery.error?.message} />
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">PSAR 指标</div>
            <div className="card-body">
              <LineChart series={psarSeries} height={300} stepline strokeWidth={2}
                colors={['#22c55e', '#ef4444']}
                xaxisOverrides={{ type: 'datetime', labels: { format: 'MM/dd', datetimeUTC: false } }}
                chartGroup="quant-group"
                loading={indicatorQuery.isLoading} error={indicatorQuery.error?.message} />
            </div>
          </div>
        </div>
      </div>

      {/* 策略参数 */}
      {strategyList.length > 0 && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <div className="row g-2 align-items-end">
              <div className="col-auto"><label className="form-label small text-muted mb-1">策略</label>
                <select className="form-select form-select-sm" style={{ width: 150 }} value={strategy}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setStrategy(newName);
                    const def = strategyList.find((s) => s.name === newName);
                    if (def && def.params) {
                      const vals = {};
                      Object.entries(def.params).forEach(([k, v]) => { vals[k] = v; });
                      setStrategyParamValues(vals);
                    } else {
                      setStrategyParamValues({});
                    }
                  }}>
                  {strategyList.map((s) => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              {Object.entries(selectedParams).map(([key, defaultVal]) => (
                <div className="col-auto" key={key}>
                  <label className="form-label small text-muted mb-1">{key}</label>
                  <input type="number" className="form-control form-control-sm" style={{ width: 100 }}
                    value={strategyParamValues[key] ?? defaultVal}
                    onChange={(e) => setStrategyParamValues((prev) => ({ ...prev, [key]: Number(e.target.value) }))} />
                </div>
              ))}
              <div className="col-auto"><label className="form-label small text-muted mb-1">初始资金</label>
                <input type="number" className="form-control form-control-sm" style={{ width: 120 }} value={initialCash} onChange={(e) => setInitialCash(Number(e.target.value))} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 策略摘要 */}
      {summary.totalTrades != null && (
        <div className="row g-3 mb-4">
          <div className="col-6 col-md-2"><DashboardCard title="初始资金" value={formatCurrency(summary.initialCash)} icon="bi-cash" color="primary" /></div>
          <div className="col-6 col-md-2"><DashboardCard title="最终权益" value={formatCurrency(summary.finalEquity)} icon="bi-graph-up" color={summary.totalReturnPct > 0 ? 'success' : 'danger'} /></div>
          <div className="col-6 col-md-2"><DashboardCard title="总收益率" value={`${summary.totalReturnPct > 0 ? '+' : ''}${summary.totalReturnPct}%`} icon="bi-percent" color={summary.totalReturnPct > 0 ? 'success' : 'danger'} /></div>
          <div className="col-6 col-md-2"><DashboardCard title="总交易次数" value={summary.totalTrades} icon="bi-list-ol" color="info" /></div>
          <div className="col-6 col-md-2"><DashboardCard title="夏普比率" value={summary.sharpeRatio != null ? summary.sharpeRatio.toFixed(2) : '-'} icon="bi-speedometer2" color={summary.sharpeRatio > 0 ? 'success' : 'warning'} /></div>
          <div className="col-6 col-md-2"><DashboardCard title="最大回撤" value={summary.maxDrawdownPct != null ? `${summary.maxDrawdownPct}%` : '-'} icon="bi-arrow-down-circle" color="danger" /></div>
        </div>
      )}

      {/* 净值曲线 + 回撤曲线 */}
      {equitySeries.length > 0 && (
        <div className="row g-3 mb-4">
          <div className="col-12 col-md-8">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 fw-semibold">净值曲线</div>
              <div className="card-body">
                <LineChart series={equitySeries} height={400} strokeWidth={2}
                  xaxisOverrides={{ type: 'datetime', labels: { format: 'MM/dd', datetimeUTC: false } }}
                  yaxisOverrides={{ labels: { formatter: (v) => (v / 10000).toFixed(1) + '万' }, title: { text: '净值' } }} />
              </div>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 fw-semibold">回撤曲线</div>
              <div className="card-body">
                <LineChart series={drawdownSeries} height={400} area strokeWidth={2}
                  xaxisOverrides={{ type: 'datetime', labels: { format: 'MM/dd', datetimeUTC: false } }}
                  yaxisOverrides={{ labels: { formatter: (v) => v + '%' }, title: { text: '回撤 (%)' }, max: 0 }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 交易明细表 */}
      {trades.length > 0 && (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white border-0 fw-semibold">交易明细</div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr><th>#</th><th>方向</th><th>入场日期</th><th>入场价</th><th>出场日期</th><th>出场价</th><th>盈亏</th><th>收益率</th></tr>
                </thead>
                <tbody>
                  {pagedTrades.map((t, idx) => (
                    <tr key={idx}>
                      <td>{t.position_id}</td>
                      <td><span className={`badge ${t.direction === 'Long' ? 'bg-success' : 'bg-danger'}`}>{t.direction}</span></td>
                      <td>{String(t.entry_date).slice(0, 10)}</td>
                      <td>{Number(t.avg_entry_price).toFixed(2)}</td>
                      <td>{String(t.exit_date).slice(0, 10)}</td>
                      <td>{Number(t.avg_exit_price).toFixed(2)}</td>
                      <td className={t.pnl >= 0 ? 'text-success' : 'text-danger'}>{formatCurrency(t.pnl)}</td>
                      <td className={t.return_pct >= 0 ? 'text-success' : 'text-danger'}>{(t.return_pct * 100).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="d-flex justify-content-center p-3">
                <nav><ul className="pagination pagination-sm mb-0">
                  <li className={`page-item ${tradesPage <= 1 ? 'disabled' : ''}`}><button className="page-link" onClick={() => setTradesPage((p) => Math.max(1, p - 1))}>上一页</button></li>
                  <li className="page-item disabled"><span className="page-link">{tradesPage} / {totalPages}</span></li>
                  <li className={`page-item ${tradesPage >= totalPages ? 'disabled' : ''}`}><button className="page-link" onClick={() => setTradesPage((p) => Math.min(totalPages, p + 1))}>下一页</button></li>
                </ul></nav>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}