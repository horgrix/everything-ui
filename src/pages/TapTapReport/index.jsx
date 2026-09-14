import { useMemo, useState } from 'react';
import useChartData from '../../hooks/useChartData';
import { querySql } from '../../api/query';
import BarChart from '../../components/charts/BarChart';
import MixedChart from '../../components/charts/MixedChart';
import DashboardCard from '../../components/layout/DashboardCard';
import { formatNumber } from '../../utils/formatters';

/** 最近 N 天 */
function recentDaysWhere(days = 3) {
  const start = new Date(Date.now() - days * 86400000);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  const d = String(start.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const TOP_N = 20;

/** 生成 n 个区分度高的颜色（黄金角分布，避免相邻雷同） */
function generateColors(n) {
  return Array.from({ length: n }, (_, i) => `hsl(${Math.round((i * 137.508) % 360)}, 65%, 52%)`);
}

/** 时间范围快捷选项 */
const TIME_RANGES = [
  { label: '最近7天', days: 7 },
  { label: '最近15天', days: 15 },
  { label: '最近1个月', days: 30 },
  { label: '最近3个月', days: 90 },
];

/** 构建聚合增量 SQL（Top100 趋势，按 app_id 分区，含日期过滤） */
function buildAggregateSql(days) {
  const dateStr = recentDaysWhere(days);
  return `
    SELECT
      app_id,
      app_name,
      crawled_at,
      pc_download_count - LAG(pc_download_count) OVER (PARTITION BY app_id ORDER BY crawled_at) AS pc_download_count,
      hits_total - LAG(hits_total) OVER (PARTITION BY app_id ORDER BY crawled_at) AS hits_total,
      hits_total_val - LAG(hits_total_val) OVER (PARTITION BY app_id ORDER BY crawled_at) AS hits_total_val
    FROM taptap_hot_list_game_hourly
    WHERE crawled_at >= '${dateStr}'
    ORDER BY crawled_at
  `;
}

/** 构建详情增量 SQL（单游戏，无日期过滤，无需分区） */
function buildDetailSql(appId) {
  return `
    SELECT
      app_id,
      app_name,
      crawled_at,
      pc_download_count - LAG(pc_download_count) OVER (ORDER BY crawled_at) AS pc_download_count,
      hits_total - LAG(hits_total) OVER (ORDER BY crawled_at) AS hits_total,
      hits_total_val - LAG(hits_total_val) OVER (ORDER BY crawled_at) AS hits_total_val
    FROM taptap_hot_list_game_hourly
    WHERE app_id = ${appId}
    ORDER BY crawled_at
  `;
}

/** 构建汇总指标 SQL（单游戏，MAX-MIN 增量，含时间过滤） */
function buildSummarySql(appId, days) {
  const dateStr = recentDaysWhere(days);
  return `
    SELECT
      app_id,
      MAX(app_name) AS app_name,
      MAX(pc_download_count) - MIN(pc_download_count) AS pc_download_count,
      MAX(hits_total) - MIN(hits_total) AS hits_total,
      MAX(fans_count) - MIN(fans_count) AS fans_count,
      MAX(review_count) - MIN(review_count) AS review_count,
      MAX(wish_count) - MIN(wish_count) AS wish_count
    FROM taptap_hot_list_game_hourly
    WHERE app_id = ${appId} AND crawled_at >= '${dateStr}'
    GROUP BY app_id
  `;
}

export default function TapTapReport() {
  const [appId, setAppId] = useState('');
  const [days, setDays] = useState(7);
  const validAppId = /^\d+$/.test(appId);
  const currentRangeLabel = TIME_RANGES.find((r) => r.days === days)?.label || `最近${days}天`;

  // 聚合图表 SQL（不按 appId 过滤，按时间范围）
  const aggregateSql = useMemo(() => buildAggregateSql(days), [days]);

  // 详情图表 SQL（按 appId 过滤）
  const detailSql = useMemo(() => buildDetailSql(appId), [appId]);

  // ====== 热门游戏Top100下载趋势（聚合） ======
  const hotListQuery = useChartData(
    'taptap-hot-list-trend',
    (p) => querySql(p.sql),
    { sql: aggregateSql },
    {
      transform: (rows) => {
        if (!rows || !rows.length) return { series: [], categories: [] };
        const timeSet = new Set();
        const nameSet = new Set();
        const map = {}; // `${name}||${time}` -> 增量下载数
        for (const r of rows) {
          const name = String(r.app_name);
          const time = String(r.crawled_at);
          timeSet.add(time);
          nameSet.add(name);
          const key = `${name}||${time}`;
          // 首条爬取增量为 null，按 0 处理
          map[key] = (map[key] || 0) + Number(r.pc_download_count || 0) + Number(r.hits_total || 0);
        }
        const categories = Array.from(timeSet).sort();

        // 按总增量下载数排序
        const sorted = Array.from(nameSet)
          .map((name) => ({
            name,
            total: categories.reduce((s, time) => s + (map[`${name}||${time}`] || 0), 0),
          }))
          .sort((a, b) => b.total - a.total);

        const topNames = sorted.slice(0, TOP_N).map((x) => x.name);
        const restNames = sorted.slice(TOP_N).map((x) => x.name);

        // Top N 各自成 series（用区分度高的颜色），其余合并为「其他」（保证顶部总数仍为全量）
        const palette = generateColors(TOP_N);
        const series = topNames.map((name, i) => ({
          name,
          color: palette[i],
          data: categories.map((time) => map[`${name}||${time}`] ?? 0),
        }));
        if (restNames.length > 0) {
          series.push({
            name: '其他',
            color: '#6c757d',
            data: categories.map((time) =>
              restNames.reduce((s, name) => s + (map[`${name}||${time}`] || 0), 0)
            ),
          });
        }

        return { categories, series };
      },
    }
  );

  // ====== 游戏详情趋势（受 AppID 查询条件控制） ======
  const detailQuery = useChartData(
    'taptap-game-detail',
    (p) => querySql(p.sql),
    { sql: detailSql },
    {
      enabled: validAppId,
      transform: (rows) => {
        if (!rows || !rows.length) return { series: [], appName: null };
        const sorted = [...rows].sort((a, b) => a.crawled_at < b.crawled_at ? -1 : 1);
        return {
          appName: sorted[0].app_name,
          series: [
            { name: '总下载数', type: 'column', yAxisIndex: 0, data: sorted.map((r) => {
              const pc = Number(r.pc_download_count || 0);
              const mobile = Number(r.hits_total || 0);
              return { x: r.crawled_at, y: pc + mobile };
            }) },
            { name: 'PC下载数占比', type: 'line', yAxisIndex: 1, data: sorted.map((r) => {
              const pc = Number(r.pc_download_count || 0);
              const mobile = Number(r.hits_total || 0);
              const total = pc + mobile;
              return { x: r.crawled_at, y: total > 0 ? parseFloat(((pc / total) * 100).toFixed(2)) : null };
            }) },
          ],
        };
      },
    }
  );

  // ====== 游戏汇总指标（受 AppID 查询条件控制） ======
  const summarySql = useMemo(() => buildSummarySql(appId, days), [appId, days]);

  const summaryQuery = useChartData(
    'taptap-game-summary',
    (p) => querySql(p.sql),
    { sql: summarySql },
    {
      enabled: validAppId,
      transform: (rows) => {
        if (!rows || !rows.length) return null;
        const r = rows[0];
        const pc = Number(r.pc_download_count || 0);
        const mobile = Number(r.hits_total || 0);
        const total = pc + mobile;
        return {
          pcDownload: pc,
          mobileDownload: mobile,
          pcRatio: total > 0 ? parseFloat(((pc / total) * 100).toFixed(2)) : null,
          fansCount: Number(r.fans_count || 0),
          reviewCount: Number(r.review_count || 0),
          wishCount: Number(r.wish_count || 0),
        };
      },
    }
  );

  const detailEmpty = !validAppId || (detailQuery.isSuccess && !detailQuery.data?.series?.length);

  return (
    <div className="container-fluid p-4">
      <h2 className="fw-bold mb-4">
        <i className="bi bi-controller text-primary me-2"></i>
        TapTap 报表
      </h2>

      {/* 热门游戏Top100下载趋势（聚合） */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-0 fw-semibold">热门游戏Top100下载趋势 — {currentRangeLabel}（增量）</div>
        <div className="card-body">
          <BarChart
            series={hotListQuery.data?.series || []}
            loading={hotListQuery.isLoading}
            error={hotListQuery.error?.message}
            height={450}
            stacked
            totalLabels
            legendOverrides={{ fontSize: '11px', itemMargin: { horizontal: 4, vertical: 1 } }}
            xaxisOverrides={hotListQuery.data?.categories ? { categories: hotListQuery.data.categories, labels: { rotate: -45 } } : {}}
            yaxisOverrides={{
              title: { text: '增量下载数' },
              labels: {
                formatter: (v) => {
                  if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(1) + '亿';
                  if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(1) + '万';
                  return v;
                },
              },
            }} />
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
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-2"><DashboardCard title="PC下载数" value={summaryQuery.data?.pcDownload != null ? formatNumber(summaryQuery.data.pcDownload) : '-'} icon="bi-pc-display" color="primary" /></div>
        <div className="col-6 col-md-2"><DashboardCard title="移动下载数" value={summaryQuery.data?.mobileDownload != null ? formatNumber(summaryQuery.data.mobileDownload) : '-'} icon="bi-phone" color="info" /></div>
        <div className="col-6 col-md-2"><DashboardCard title="PC占比" value={summaryQuery.data?.pcRatio != null ? `${summaryQuery.data.pcRatio}%` : '-'} icon="bi-percent" color="success" /></div>
        <div className="col-6 col-md-2"><DashboardCard title="关注数" value={summaryQuery.data?.fansCount != null ? formatNumber(summaryQuery.data.fansCount) : '-'} icon="bi-heart" color="danger" /></div>
        <div className="col-6 col-md-2"><DashboardCard title="评价数" value={summaryQuery.data?.reviewCount != null ? formatNumber(summaryQuery.data.reviewCount) : '-'} icon="bi-chat" color="warning" /></div>
        <div className="col-6 col-md-2"><DashboardCard title="收藏数" value={summaryQuery.data?.wishCount != null ? formatNumber(summaryQuery.data.wishCount) : '-'} icon="bi-star" color="secondary" /></div>
      </div>

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
              yaxisLeft={{ title: { text: '总下载数' }, labels: { formatter: (v) => (v >= 10000 ? (v / 10000).toFixed(1) + '万' : v.toLocaleString('zh-CN')) } }}
              yaxisRight={{ title: { text: 'PC下载数占比 (%)' }, min: 0, max: 100, labels: { formatter: (v) => v.toFixed(2) + '%' } }} />
          )}
        </div>
      </div>
    </div>
  );
}
