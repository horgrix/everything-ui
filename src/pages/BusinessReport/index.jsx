import { useState, useMemo } from 'react';
import useChartData from '../../hooks/useChartData';
import query from '../../api/query';
import LineChart from '../../components/charts/LineChart';
import HeatmapChart from '../../components/charts/HeatmapChart';
import MixedChart from '../../components/charts/MixedChart';

const TABLE_NAME = 'steam_best_seller_list_hourly';
const WEEKLY_TABLE_NAME = 'steam_best_seller_list_weekly';
const PEAK_TABLE_NAME = 'steam_game_peak_players_hourly';
const MONTHLY_PEAK_TABLE = 'steam_game_peak_players_monthly';
const REVIEW_RECENT_TABLE = 'steam_player_review_recent';
const REVIEW_ROLLUP_TABLE = 'steam_player_review_rollup';
const SEASON_TABLE_NAME = 'torchlight_season_steam_peak_players';

const STEAM_GAMES = {
  '1974050': '火炬之光国际服',
  '2315040': '火炬之光国服',
  '4025700': '心动小镇国际服',
};

const GAME_IDS = Object.keys(STEAM_GAMES);

/** 最近 N 天 */
function recentDaysWhere(days = 3) {
  const now = new Date();
  const start = new Date(now - days * 86400000);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  const d = String(start.getDate()).padStart(2, '0');
  return [{ col: 'crawled_at', op: '>=', value: `${y}-${m}-${d} 00:00:00` }];
}

/** 金额格式化 */
function formatAmount(v) {
  const abs = Math.abs(v);
  if (abs >= 1e8) return (v / 1e8).toFixed(1) + '亿';
  if (abs >= 1e4) return (v / 1e4).toFixed(1) + '万';
  return String(v);
}

/** 最近 N 个月 */
function recentMonthsWhere(months = 9) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - months, 1);
  const val = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  return [{ col: 'crawled_at', op: '>=', value: val }];
}

export default function BusinessReport() {
  const [selectedId, setSelectedId] = useState('1974050');

  // 折线图 where（3天）
  const trendWhere = useMemo(() => {
    const c = recentDaysWhere(3);
    if (selectedId) c.push({ col: 'steam_id', op: '=', value: selectedId });
    return c;
  }, [selectedId]);

  // 热力图 where（9个月）
  const heatmapWhere = useMemo(() => {
    const c = recentMonthsWhere(9);
    if (selectedId) c.push({ col: 'steam_id', op: '=', value: selectedId });
    return c;
  }, [selectedId]);

  // 峰值人数 where（30天，用 stat_ts 时间戳过滤）
  const peakWhere = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    const c = [{ col: 'stat_ts', op: '>=', value: cutoff }];
    if (selectedId) c.push({ col: 'steam_id', op: '=', value: selectedId });
    return c;
  }, [selectedId]);

  // 评论 where
  const reviewWhere = useMemo(() => {
    const c = [];
    if (selectedId) c.push({ col: 'steam_id', op: '=', value: selectedId });
    return c;
  }, [selectedId]);

  // 赛季对比 where
  const seasonWhere = useMemo(() => {
    const c = [];
    if (selectedId) c.push({ col: 'steam_id', op: '=', value: selectedId });
    return c;
  }, [selectedId]);

  // ====== 折线图 ======
  const trendQuery = useChartData(
    'steam-rank-trend',
    (p) => query(TABLE_NAME, p),
    {
      fields: 'steam_id,rank,region,crawled_at',
      where: trendWhere,
      order_by: 'crawled_at ASC',
      limit: 9999,
    },
    {
      transform: (rows) => {
        if (!rows || rows.length === 0) return { series: [] };
        const groups = {};
        for (const row of rows) {
          const key = row.region || 'unknown';
          if (!groups[key]) groups[key] = [];
          const ts = row.crawled_at;
          groups[key].push({
            x: ts.includes(':') ? ts : ts + ':00',
            y: Number(row.rank),
          });
        }
        return {
          series: Object.entries(groups).map(([name, data]) => ({ name, data })),
        };
      },
    }
  );

  // ====== 热力图 ======
  const heatmapQuery = useChartData(
    'steam-rank-heatmap',
    (p) => query(WEEKLY_TABLE_NAME, p),
    {
      fields: 'region,crawled_at,rank',
      where: heatmapWhere,
      order_by: 'crawled_at ASC',
      limit: 9999,
    },
    {
      transform: (rows) => {
        if (!rows || rows.length === 0) return { series: [], categories: [] };

        // 1) 收集所有唯一日期并排序
        const dateSet = new Set();
        for (const r of rows) {
          dateSet.add(String(r.crawled_at).slice(0, 10));
        }
        const categories = Array.from(dateSet).sort();

        // 2) 按 region 收集原始数据，做快速查找 map
        const rawMap = {};
        for (const r of rows) {
          const region = r.region || 'unknown';
          const date   = String(r.crawled_at).slice(0, 10);
          const key    = `${region}||${date}`;
          if (!rawMap[key]) rawMap[key] = Number(r.rank);
        }
        const regions = [...new Set(Object.keys(rawMap).map(k => k.split('||')[0]))];

        // 3) 为每个 region 生成统一对齐的数据（缺失日期填 null）
        const series = regions.map(region => ({
          name: region,
          data: categories.map(date => {
            const key = `${region}||${date}`;
            return { x: date, y: rawMap[key] ?? null };
          }),
        }));

        return { series, categories };
      },
    }
  );

  // ====== 峰值在线人数 ======
  const peakQuery = useChartData(
    'steam-peak-players',
    (p) => query(PEAK_TABLE_NAME, p),
    {
      fields: 'stat_ts,peak_players',
      where: peakWhere,
      order_by: 'stat_ts ASC',
      limit: 9999,
    },
    {
      transform: (rows) => {
        if (!rows || rows.length === 0) return { series: [], xaxisMin: null, avgAnnotation: null };
        const data = rows.map((r) => [Number(r.stat_ts), Number(r.peak_players)]);
        const xaxisMin = rows[0].stat_ts;
        const avg = rows.reduce((s, r) => s + Number(r.peak_players), 0) / rows.length;
        return {
          series: [{ name: STEAM_GAMES[selectedId] || '峰值在线', data }],
          xaxisMin,
          avgAnnotation: { y: Math.round(avg), label: '近30天平均玩家', color: '#ff9f1c', dash: 2 },
        };
      },
    }
  );

  // ====== 辅助：评论数据转 MixedChart 格式 ======
  function reviewTransform(rows) {
    if (!rows || rows.length === 0) return { series: [] };
    const data = rows
      .map((r) => ({
        x: Number(r.stat_ts) * 1000, // 秒 → 毫秒
        up: Number(r.up),
        down: Number(r.down),
      }))
      .sort((a, b) => a.x - b.x);
    return {
      series: [
        {
          name: '推荐',
          type: 'column',
          yAxisIndex: 0,
          data: data.map((d) => ({ x: d.x, y: d.up })),
        },
        {
          name: '不推荐',
          type: 'column',
          yAxisIndex: 0,
          data: data.map((d) => ({ x: d.x, y: -d.down })),
        },
        {
          name: '推荐率',
          type: 'line',
          yAxisIndex: 1,
          data: data.map((d) => ({
            x: d.x,
            y: parseFloat(((d.up / (d.up + d.down)) * 100).toFixed(2)),
          })),
        },
      ],
    };
  }

  // ====== 最近评论 ======
  const recentReviewQuery = useChartData(
    'steam-review-recent',
    (p) => query(REVIEW_RECENT_TABLE, p),
    { fields: 'stat_ts,up,down', where: reviewWhere, order_by: 'stat_ts ASC', limit: 9999 },
    { transform: reviewTransform }
  );

  // ====== 历史评论 ======
  const rollupReviewQuery = useChartData(
    'steam-review-rollup',
    (p) => query(REVIEW_ROLLUP_TABLE, p),
    { fields: 'stat_ts,up,down', where: reviewWhere, order_by: 'stat_ts ASC', limit: 9999 },
    { transform: reviewTransform }
  );

  // ====== 峰值在线人数月趋势 ======
  const monthlyPeakWhere = useMemo(() => {
    const start = new Date();
    start.setMonth(start.getMonth() - 13);
    const val = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
    const c = [{ col: 'stat_month', op: '>=', value: val }];
    if (selectedId) c.push({ col: 'steam_id', op: '=', value: selectedId });
    return c;
  }, [selectedId]);

  const monthlyPeakQuery = useChartData(
    'steam-monthly-peak',
    (p) => query(MONTHLY_PEAK_TABLE, p),
    { fields: 'stat_month,avg_players,peak_players', where: monthlyPeakWhere, order_by: 'stat_month ASC', limit: 200 },
    {
      transform: (rows) => {
        if (!rows || !rows.length) return { series: [] };
        const sorted = [...rows].sort((a, b) => a.stat_month < b.stat_month ? -1 : 1);
        return {
          series: [
            { name: '平均在线', type: 'column', yAxisIndex: 0, data: sorted.map((r) => ({ x: String(r.stat_month).slice(0, 7), y: Number(r.avg_players) })) },
            { name: '峰值在线', type: 'line', yAxisIndex: 1, data: sorted.map((r) => ({ x: String(r.stat_month).slice(0, 7), y: Number(r.peak_players) })) },
          ],
        };
      },
    }
  );

  // ====== 赛季对比 ======
  const seasonQuery = useChartData(
    'torchlight-season-peak',
    (p) => query(SEASON_TABLE_NAME, p),
    { fields: 'ss,ss_day,peak_players', where: seasonWhere, order_by: 'ss ASC, ss_day ASC', limit: 9999 },
    {
      transform: (rows) => {
        if (!rows || !rows.length) return { series: [], avgAnnotations: [] };
        const groups = {};
        for (const r of rows) {
          const key = `S${r.ss}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push({ x: Number(r.ss_day), y: Number(r.peak_players) });
        }
        const seasonColors = ['#97c786', '#7dc3ea', '#ffa600', '#f46a64', '#fcaaa6'];
        // 计算每个赛季的平均值作为 Y 轴标注，颜色与折线对应
        const avgAnnotations = Object.entries(groups).map(([name, data], idx) => {
          const avg = data.reduce((s, d) => s + d.y, 0) / data.length;
          return { y: avg, label: `${name} 均值`, color: seasonColors[idx % seasonColors.length], dash: 2 };
        });
        return {
          series: Object.entries(groups).map(([name, data]) => ({ name, data })),
          avgAnnotations,
        };
      },
    }
  );

  // 赛季支持的游戏 ID
  const SEASON_GAME_IDS = ['1974050', '2315040'];
  const showSeason = SEASON_GAME_IDS.includes(selectedId);

  return (
    <div className="container-fluid p-4">
      <h2 className="fw-bold mb-4">
        <i className="bi bi-bar-chart text-primary me-2"></i>
        Steam 畅销榜排名趋势
      </h2>

      {/* 筛选栏 */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="d-flex align-items-center flex-wrap gap-2">
            <span className="text-muted small me-2">选择游戏:</span>
            {GAME_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={`btn btn-sm ${selectedId === id ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setSelectedId(id)}
              >
                {STEAM_GAMES[id]}
              </button>
            ))}
            <span className="ms-auto text-muted small">
              已选: {STEAM_GAMES[selectedId]}
            </span>
          </div>
        </div>
      </div>

      {/* 第一部分: 折线图（最近3天） */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-0 fw-semibold">
          <span>排名趋势 — 最近3天（Y轴倒序: 排名1=顶部）</span>
        </div>
        <div className="card-body">
          <LineChart
            series={trendQuery.data?.series || []}
            loading={trendQuery.isLoading}
            error={trendQuery.error?.message}
            height={450}
            xaxisOverrides={{
              type: 'datetime',
              labels: { format: 'MM/dd HH:mm', datetimeUTC: false, rotate: -45 },
            }}
            yaxisOverrides={{
              reversed: true,
              tickAmount: 10,
              labels: { formatter: (val) => Math.round(val) },
              title: { text: '排名' },
            }}
            strokeWidth={2}
            markers={3}
          />
        </div>
      </div>

      {/* 第二部分: 热力图（最近9个月） */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-0 fw-semibold">
          <span>排名热力图 — 最近9个月（X=日期, Y=地区, 值=排名）</span>
        </div>
        <div className="card-body">
          <HeatmapChart
            series={heatmapQuery.data?.series || []}
            loading={heatmapQuery.isLoading}
            error={heatmapQuery.error?.message}
            height={500}
            xaxisOverrides={heatmapQuery.data?.categories ? { categories: heatmapQuery.data.categories } : {}}
            colorScale={[
              { from: 1, to: 10, name: 'top10', color: '#831A21' },
              { from: 11, to: 20, name: 'top20', color: '#A13D3B' },
              { from: 21, to: 30, name: 'top30', color: '#C16D58' },
              { from: 31, to: 40, name: 'top40', color: '#ECD0B4' },
              { from: 41, to: 50, name: 'top50', color: '#F2EBE5' },
              { from: 51, to: 60, name: 'top60', color: '#C8D6E7' },
              { from: 61, to: 70, name: 'top70', color: '#9EBCDB' },
              { from: 71, to: 80, name: 'top80', color: '#7091C7' },
              { from: 81, to: 90, name: 'top90', color: '#4E70AF' },
              { from: 91, to: 100, name: 'top100', color: '#375093' },
            ]}
            valueFormatter={(val) => Math.round(val)}
          />
        </div>
      </div>

      {/* 第三部分: 峰值在线人数月趋势 + 峰值在线人数 */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-8">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">峰值在线人数月趋势</div>
            <div className="card-body">
              <MixedChart
                series={monthlyPeakQuery.data?.series || []}
                loading={monthlyPeakQuery.isLoading}
                error={monthlyPeakQuery.error?.message}
                height={400}
                colors={['#4361ee', '#e71d36']}
                strokeWidths={[0, 2]}
                tooltipY={(v, yi) => yi === 1 ? formatAmount(v) : formatAmount(v)}
                xaxisOverrides={{ type: 'category', labels: { rotate: -45 } }}
                yaxisLeft={{ title: { text: '平均在线' }, labels: { formatter: (v) => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v } }}
                yaxisRight={{ title: { text: '峰值在线' }, labels: { formatter: (v) => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v } }} />
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">峰值在线人数（最近30天）</div>
            <div className="card-body">
              <LineChart
                series={peakQuery.data?.series || []}
                loading={peakQuery.isLoading}
                error={peakQuery.error?.message}
                area
                height={400}
                xaxisOverrides={{
                  type: 'datetime',
                  min: peakQuery.data?.xaxisMin,
                  labels: { format: 'MM/dd', datetimeUTC: false, rotate: -45 },
                }}
                yaxisOverrides={{
                  labels: { formatter: (v) => v >= 10000 ? (v / 10000).toFixed(1) + '万' : v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v },
                  title: { text: '在线' },
                }}
                yaxisAnnotations={peakQuery.data?.avgAnnotation ? [peakQuery.data.avgAnnotation] : []} />
            </div>
          </div>
        </div>
      </div>

      {/* 第五部分: 赛季对比（仅火炬之光） */}
      {showSeason && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-white border-0 fw-semibold">赛季峰值在线对比</div>
          <div className="card-body">
            <LineChart
              series={seasonQuery.data?.series || []}
              loading={seasonQuery.isLoading}
              error={seasonQuery.error?.message}
              height={400}
              colors={['#97c786', '#7dc3ea', '#ffa600', '#f46a64', '#fcaaa6']}
              xaxisOverrides={{ type: 'numeric', title: { text: '赛季天数' }, labels: { formatter: (v) => String(Math.round(v)) } }}
              yaxisOverrides={{ labels: { formatter: (v) => (v >= 10000 ? (v / 10000).toFixed(1) + '万' : v) }, title: { text: '峰值在线' } }}
              strokeWidth={2} markers={3}
              yaxisAnnotations={seasonQuery.data?.avgAnnotations || []} />
          </div>
        </div>
      )}

      {/* 第四部分: 评论分析（左右并排） */}
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">最近评论</div>
            <div className="card-body">
              <MixedChart series={recentReviewQuery.data?.series || []} loading={recentReviewQuery.isLoading} error={recentReviewQuery.error?.message} height={400}
                colors={['#2ec4b6', '#e71d36', '#4361ee']} strokeWidths={[0, 0, 2]}
                xaxisOverrides={{ type: 'datetime', labels: { format: 'MM/dd', datetimeUTC: false } }}
                yaxisLeft={{ title: { text: '评论数' }, labels: { formatter: (v) => (v >= 0 ? String(Math.round(v)) : String(Math.round(Math.abs(v)))) } }}
                yaxisRight={{ title: { text: '推荐率 (%)' }, min: 0, max: 100, labels: { formatter: (v) => v.toFixed(1) + '%' } }} />
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">历史评论</div>
            <div className="card-body">
              <MixedChart series={rollupReviewQuery.data?.series || []} loading={rollupReviewQuery.isLoading} error={rollupReviewQuery.error?.message} height={400}
                colors={['#2ec4b6', '#e71d36', '#4361ee']} strokeWidths={[0, 0, 2]}
                xaxisOverrides={{ type: 'datetime', labels: { format: 'MM/dd', datetimeUTC: false } }}
                yaxisLeft={{ title: { text: '评论数' }, labels: { formatter: (v) => (v >= 0 ? String(Math.round(v)) : String(Math.round(Math.abs(v)))) } }}
                yaxisRight={{ title: { text: '推荐率 (%)' }, min: 0, max: 100, labels: { formatter: (v) => v.toFixed(1) + '%' } }} />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
