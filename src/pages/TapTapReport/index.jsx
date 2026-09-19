import { useMemo, useState } from 'react';
import useChartData from '../../hooks/useChartData';
import { querySql } from '../../api/query';
import BarChart from '../../components/charts/BarChart';
import MixedChart from '../../components/charts/MixedChart';
import LineChart from '../../components/charts/LineChart';
import PieChart from '../../components/charts/PieChart';
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

/** 最近 N 小时 */
function recentHoursWhere(hours) {
  const start = new Date(Date.now() - hours * 3600000);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  const d = String(start.getDate()).padStart(2, '0');
  const h = String(start.getHours()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}`;
}

const TOP_N = 50;
const TOP25_PAGE_SIZE = 5;

/** 生成 n 个区分度高的颜色（黄金角分布，避免相邻雷同） */
function generateColors(n) {
  return Array.from({ length: n }, (_, i) => `hsl(${Math.round((i * 137.508) % 360)}, 65%, 52%)`);
}

/** 时间范围快捷选项 */
const TIME_RANGES = [
  { label: '最近1天', days: 1 },
  { label: '最近3天', days: 3 },
  { label: '最近7天', days: 7 },
  { label: '最近15天', days: 15 },
  { label: '最近1个月', days: 30 },
  { label: '最近3个月', days: 90 },
];

/** 构建聚合增量 SQL（近48小时，按 crawled_at 汇总所有游戏增量） */
function buildAggregateSql() {
  const dateStr = recentHoursWhere(48);
  return `
    SELECT
      crawled_at,
      SUM(pc_download_count) as pc_download_count,
      SUM(hits_total) as hits_total,
      SUM(hits_total_val) as hits_total_val,
      SUM(pc_download_count) + SUM(hits_total) as download_count
    FROM (
      SELECT
        app_id,
        crawled_at AS crawled_at,
        pc_download_count - LAG(pc_download_count) OVER (PARTITION BY app_id ORDER BY crawled_at) AS pc_download_count,
        hits_total - LAG(hits_total) OVER (PARTITION BY app_id ORDER BY crawled_at) AS hits_total,
        hits_total_val - LAG(hits_total_val) OVER (PARTITION BY app_id ORDER BY crawled_at) AS hits_total_val
      FROM taptap_hot_list_game_hourly
      WHERE crawled_at >= '${dateStr}'
    ) t1
    GROUP BY crawled_at
    HAVING SUM(pc_download_count) + SUM(hits_total) > 0
    ORDER BY crawled_at
  `;
}

/** 构建详情增量 SQL（单游戏，按时间范围过滤，无需分区） */
function buildDetailSql(appId, days) {
  const dateStr = recentDaysWhere(days);
  return `
    SELECT
      app_id,
      app_name,
      crawled_at,
      pc_download_count - LAG(pc_download_count) OVER (ORDER BY crawled_at) AS pc_download_count,
      hits_total - LAG(hits_total) OVER (ORDER BY crawled_at) AS hits_total,
      hits_total_val - LAG(hits_total_val) OVER (ORDER BY crawled_at) AS hits_total_val
    FROM taptap_hot_list_game_hourly
    WHERE app_id = ${appId} AND crawled_at >= '${dateStr}'
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

/** 构建最新快照 SQL（单游戏，最新一条累计值） */
function buildLatestSql(appId) {
  return `
    SELECT
      app_id,
      app_name,
      pc_download_count,
      hits_total,
      hits_total_val,
      fans_count,
      review_count,
      wish_count
    FROM taptap_hot_list_game_hourly
    WHERE app_id = ${appId}
    ORDER BY crawled_at DESC
    LIMIT 1
  `;
}

/** 最近 N 个月的第一天 */
function recentMonthsWhere(months) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - months, 1);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
}

/** 构建 TopN 下载趋势 SQL（按天/月聚合，各游戏 MAX-MIN 增量再汇总） */
function buildTrendSql(substrLen, dateStr) {
  return `
    SELECT
      crawled_at,
      SUM(pc_download_count) as pc_download_count,
      SUM(hits_total) as hits_total,
      SUM(hits_total_val) as hits_total_val,
      SUM(fans_count) as fans_count,
      SUM(review_count) as review_count,
      SUM(wish_count) as wish_count
    FROM
    (
      SELECT
        app_id,
        substr(crawled_at, 1, ${substrLen}) as crawled_at,
        MAX(pc_download_count) - MIN(pc_download_count) as pc_download_count,
        MAX(hits_total) - MIN(hits_total) as hits_total,
        MAX(hits_total_val) - MIN(hits_total_val) as hits_total_val,
        MAX(fans_count) - MIN(fans_count) as fans_count,
        MAX(review_count) - MIN(review_count) as review_count,
        MAX(wish_count) - MIN(wish_count) as wish_count
      FROM taptap_hot_list_game_hourly
      WHERE crawled_at >= '${dateStr}'
      GROUP BY app_id, substr(crawled_at, 1, ${substrLen})
    )
    GROUP BY crawled_at
    ORDER BY crawled_at
  `;
}

/** 构建日趋势 SQL（最近15天，含创意工坊AI游戏计数） */
function buildDailyTrendSql() {
  const dateStr = recentDaysWhere(15);
  return `
    SELECT
      crawled_at,
      SUM(pc_download_count) as pc_download_count,
      SUM(hits_total) as hits_total,
      SUM(CASE WHEN hits_total_val IS NULL AND hits_total IS NOT NULL AND hits_total > 0 THEN hits_total ELSE 0 END) as ai_game_count
    FROM (
      SELECT
        app_id,
        substr(crawled_at, 1, 10) as crawled_at,
        MAX(pc_download_count) - MIN(pc_download_count) as pc_download_count,
        MAX(hits_total) - MIN(hits_total) as hits_total,
        MAX(hits_total_val) - MIN(hits_total_val) as hits_total_val
      FROM taptap_hot_list_game_hourly
      WHERE crawled_at >= '${dateStr}'
      GROUP BY app_id, substr(crawled_at, 1, 10)
    )
    GROUP BY crawled_at
    ORDER BY crawled_at
  `;
}

/** 构建月趋势 SQL（最近3个月，含创意工坊AI游戏计数） */
function buildMonthlyTrendSql() {
  const dateStr = recentMonthsWhere(3);
  return `
    SELECT
      crawled_at,
      SUM(pc_download_count) as pc_download_count,
      SUM(hits_total) as hits_total,
      SUM(hits_total_val) as hits_total_val,
      SUM(CASE WHEN hits_total_val IS NULL AND hits_total IS NOT NULL AND hits_total > 0 THEN hits_total ELSE 0 END) as ai_game_count
    FROM (
      SELECT
        app_id,
        substr(crawled_at, 1, 7) as crawled_at,
        MAX(pc_download_count) - MIN(pc_download_count) as pc_download_count,
        MAX(hits_total) - MIN(hits_total) as hits_total,
        MAX(hits_total_val) - MIN(hits_total_val) as hits_total_val
      FROM taptap_hot_list_game_hourly
      WHERE crawled_at >= '${dateStr}'
      GROUP BY app_id, substr(crawled_at, 1, 7)
    )
    GROUP BY crawled_at
    ORDER BY crawled_at
  `;
}

/** 构建下载Top25明细 SQL（最近8小时，最新时间点的Top25，含增长指标） */
function buildTop25Sql() {
  const dateStr = recentHoursWhere(8);
  return `
    SELECT
      crawled_at,
      app_id,
      app_name,
      pc_download_count,
      download_count,
      download_growth,
      ROUND(download_growth * 100.0 / NULLIF(prev_download_count, 0), 2) AS growth_rate
    FROM (
      SELECT
        crawled_at,
        app_id,
        app_name,
        pc_download_count,
        download_count,
        prev_download_count,
        download_count - prev_download_count AS download_growth,
        ROW_NUMBER() OVER (PARTITION BY crawled_at ORDER BY download_count DESC) AS rn
      FROM (
        SELECT
          app_id,
          app_name,
          crawled_at,
          pc_download_count,
          pc_download_count + hits_total AS download_count,
          LAG(pc_download_count + hits_total) OVER (PARTITION BY app_id ORDER BY crawled_at) AS prev_download_count
        FROM (
          SELECT
            app_id,
            app_name,
            crawled_at,
            pc_download_count - LAG(pc_download_count) OVER (PARTITION BY app_id ORDER BY crawled_at) AS pc_download_count,
            hits_total - LAG(hits_total) OVER (PARTITION BY app_id ORDER BY crawled_at) AS hits_total
          FROM taptap_hot_list_game_hourly
          WHERE crawled_at >= '${dateStr}'
        ) t1
      ) t2
    ) t3
    WHERE rn <= 25
    ORDER BY crawled_at DESC, rn
    LIMIT 25
  `;
}

/** 构建 PC下载Top25明细 SQL（最近8小时，最新时间点的Top25，含增长指标） */
function buildPcTop25Sql() {
  const dateStr = recentHoursWhere(8);
  return `
    SELECT
      crawled_at,
      app_id,
      app_name,
      pc_download_count,
      download_growth,
      ROUND(download_growth * 100.0 / NULLIF(prev_download_count, 0), 2) AS growth_rate
    FROM (
      SELECT
        crawled_at,
        app_id,
        app_name,
        pc_download_count,
        prev_download_count,
        pc_download_count - prev_download_count AS download_growth,
        ROW_NUMBER() OVER (
          PARTITION BY crawled_at
          ORDER BY pc_download_count DESC
        ) AS rn
      FROM (
        SELECT
          app_id,
          app_name,
          crawled_at,
          pc_download_count,
          LAG(pc_download_count) OVER (PARTITION BY app_id ORDER BY crawled_at) AS prev_download_count
        FROM (
          SELECT
            app_id,
            app_name,
            crawled_at,
            pc_download_count - LAG(pc_download_count) OVER (PARTITION BY app_id ORDER BY crawled_at) AS pc_download_count
          FROM taptap_hot_list_game_hourly
          WHERE crawled_at >= '${dateStr}'
            AND pc_download_count IS NOT NULL
            AND pc_download_count > 0
        ) t1
      ) t2
    ) t3
    WHERE rn <= 25
    ORDER BY crawled_at DESC, rn
    LIMIT 25
  `;
}

/** 构建 创意工坊下载Top25明细 SQL（最近8小时，最新时间点的Top25，含增长指标） */
function buildCreativeTop25Sql() {
  const dateStr = recentHoursWhere(8);
  return `
    SELECT
      crawled_at,
      app_id,
      app_name,
      download_count,
      download_growth,
      ROUND(download_growth * 100.0 / NULLIF(prev_download_count, 0), 2) AS growth_rate
    FROM (
      SELECT
        crawled_at,
        app_id,
        app_name,
        download_count,
        prev_download_count,
        download_count - prev_download_count AS download_growth,
        ROW_NUMBER() OVER (
          PARTITION BY crawled_at
          ORDER BY download_count DESC
        ) AS rn
      FROM (
        SELECT
          app_id,
          app_name,
          crawled_at,
          hits_total AS download_count,
          LAG(hits_total) OVER (PARTITION BY app_id ORDER BY crawled_at) AS prev_download_count
        FROM (
          SELECT
            app_id,
            app_name,
            crawled_at,
            hits_total - LAG(hits_total) OVER (PARTITION BY app_id ORDER BY crawled_at) AS hits_total
          FROM taptap_hot_list_game_hourly
          WHERE crawled_at >= '${dateStr}'
            AND hits_total IS NOT NULL
            AND hits_total_val IS NULL
            AND hits_total > 0
        ) t1
      ) t2
    ) t3
    WHERE rn <= 25
    ORDER BY crawled_at DESC, rn
    LIMIT 25
  `;
}

/** 构建追踪的游戏分布 SQL（最近8小时，最新快照） */
function buildDistributionSql() {
  const dateStr = recentHoursWhere(8);
  return `
    SELECT
      crawled_at,
      COUNT(*) as total,
      SUM(CASE WHEN pc_download_count > 0 THEN 1 ELSE 0 END) as pc_game_count,
      SUM(CASE WHEN hits_total_val IS NOT NULL AND hits_total_val > 0 THEN 1 ELSE 0 END) as app_game_count,
      SUM(CASE WHEN hits_total_val IS NULL AND hits_total IS NOT NULL AND hits_total > 0 THEN 1 ELSE 0 END) as ai_game_count
    FROM taptap_hot_list_game_hourly
    WHERE crawled_at >= '${dateStr}'
    GROUP BY crawled_at
    ORDER BY crawled_at DESC
    LIMIT 1
  `;
}

/** 简易 Top25 明细表格（PC/创意工坊两栏并排复用，含排名徽章与分页） */
function Top25DetailTable({ title, rows, countHeader }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / TOP25_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = rows.slice((currentPage - 1) * TOP25_PAGE_SIZE, currentPage * TOP25_PAGE_SIZE);

  return (
    <div className="col-12 col-md-6">
      <div className="card border-0 shadow-sm h-100">
        <div className="card-header bg-white border-0 fw-semibold">{title}</div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="text-center" style={{ width: 60 }}>#</th>
                  <th>AppID</th>
                  <th>游戏名称</th>
                  <th className="text-end">{countHeader}</th>
                  <th className="text-end">增长</th>
                  <th className="text-end">增长率</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.length ? (
                  pagedRows.map((row, idx) => {
                    const rank = (currentPage - 1) * TOP25_PAGE_SIZE + idx + 1;
                    return (
                      <tr key={idx}>
                        <td className="text-center" style={{ width: 60 }}>
                          {rank <= 3 ? (
                            <span className={`badge ${rank === 1 ? 'bg-warning text-dark' : rank === 2 ? 'bg-secondary' : 'bg-danger'}`}>{rank}</span>
                          ) : (
                            <span className="text-muted">{rank}</span>
                          )}
                        </td>
                        <td className="text-muted small">{row.appId}</td>
                        <td className="fw-semibold">{row.appName}</td>
                        <td className="text-end fw-semibold">{formatNumber(row.downloadCount)}</td>
                        <td className="text-end">
                          {row.downloadGrowth == null ? '-' : (
                            <span className={row.downloadGrowth > 0 ? 'text-success' : row.downloadGrowth < 0 ? 'text-danger' : ''}>
                              {row.downloadGrowth > 0 ? '+' : ''}{formatNumber(row.downloadGrowth)}
                            </span>
                          )}
                        </td>
                        <td className="text-end">
                          {row.growthRate == null ? '-' : (
                            <span className={row.growthRate > 0 ? 'text-success' : row.growthRate < 0 ? 'text-danger' : ''}>
                              {row.growthRate > 0 ? '+' : ''}{row.growthRate}%
                            </span>
                          )}
                        </td>
                        <td className="text-muted small">{row.crawledAt}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">暂无数据</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="d-flex justify-content-center p-3">
              <nav><ul className="pagination pagination-sm mb-0">
                <li className={`page-item ${currentPage <= 1 ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</button>
                </li>
                <li className="page-item disabled"><span className="page-link">{currentPage} / {totalPages}</span></li>
                <li className={`page-item ${currentPage >= totalPages ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>下一页</button>
                </li>
              </ul></nav>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TapTapReport() {
  const [appId, setAppId] = useState('');
  const [days, setDays] = useState(1);
  const [top25Page, setTop25Page] = useState(1);
  const validAppId = /^\d+$/.test(appId);

  // 聚合图表 SQL（固定近24小时，不受查询条件影响）
  const aggregateSql = useMemo(() => buildAggregateSql(), []);

  // 详情图表 SQL（按 appId 过滤）
  const detailSql = useMemo(() => buildDetailSql(appId, days), [appId, days]);

  // ====== 热门游戏TopN下载趋势（聚合） ======
  const hotListQuery = useChartData(
    'taptap-hot-list-trend',
    (p) => querySql(p.sql),
    { sql: aggregateSql },
    {
      transform: (rows) => {
        if (!rows || !rows.length) return { series: [], categories: [] };
        const sorted = [...rows].sort((a, b) => a.crawled_at < b.crawled_at ? -1 : 1);
        const categories = sorted.map((r) => r.crawled_at);
        return {
          categories,
          series: [
            { name: '移动端下载', color: '#2ec4b6', data: sorted.map((r) => Number(r.hits_total || 0)) },
            { name: 'PC端下载', color: '#4361ee', data: sorted.map((r) => Number(r.pc_download_count || 0)) },
          ],
        };
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

  // ====== 游戏最新快照指标（受 AppID 查询条件控制） ======
  const latestSql = useMemo(() => buildLatestSql(appId), [appId]);

  const latestQuery = useChartData(
    'taptap-game-latest',
    (p) => querySql(p.sql),
    { sql: latestSql },
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

  // ====== 热门游戏TopN下载日趋势（固定最近15天） ======
  const dailyTrendSql = useMemo(() => buildDailyTrendSql(), []);

  const dailyTrendQuery = useChartData(
    'taptap-daily-trend',
    (p) => querySql(p.sql),
    { sql: dailyTrendSql },
    {
      transform: (rows) => {
        if (!rows || !rows.length) return { series: [] };
        const sorted = [...rows].sort((a, b) => a.crawled_at < b.crawled_at ? -1 : 1);
        return {
          series: [
            { name: '总下载数', data: sorted.map((r) => ({ x: r.crawled_at, y: Number(r.pc_download_count || 0) + Number(r.hits_total || 0) })) },
            { name: 'PC下载数', data: sorted.map((r) => ({ x: r.crawled_at, y: Number(r.pc_download_count || 0) })) },
            { name: '创意工坊下载数', data: sorted.map((r) => ({ x: r.crawled_at, y: Number(r.ai_game_count || 0) })) },
          ],
        };
      },
    }
  );

  // ====== 热门游戏TopN下载月趋势（固定最近3个月） ======
  const monthlyTrendSql = useMemo(() => buildMonthlyTrendSql(), []);

  const monthlyTrendQuery = useChartData(
    'taptap-monthly-trend',
    (p) => querySql(p.sql),
    { sql: monthlyTrendSql },
    {
      transform: (rows) => {
        if (!rows || !rows.length) return { series: [] };
        const sorted = [...rows].sort((a, b) => a.crawled_at < b.crawled_at ? -1 : 1);
        return {
          categories: sorted.map((r) => r.crawled_at),
          series: [
            { name: 'App下载数', color: '#2ec4b6', data: sorted.map((r) => Number(r.hits_total_val || 0)) },
            { name: '创意工坊下载数', color: '#f77f00', data: sorted.map((r) => Number(r.ai_game_count || 0)) },
            { name: 'PC下载数', color: '#4361ee', data: sorted.map((r) => Number(r.pc_download_count || 0)) },
          ],
        };
      },
    }
  );

  // ====== 下载Top25明细列表（固定最近8小时） ======
  const top25Sql = useMemo(() => buildTop25Sql(), []);

  const top25Query = useChartData(
    'taptap-top25-list',
    (p) => querySql(p.sql),
    { sql: top25Sql },
    {
      transform: (rows) => {
        if (!rows || !rows.length) return { rows: [] };
        return {
          rows: rows.map((r) => {
            const pc = Number(r.pc_download_count || 0);
            const total = Number(r.download_count || 0);
            return {
              appId: r.app_id,
              appName: r.app_name,
              downloadCount: total,
              pcDownloadCount: pc,
              pcRatio: total > 0 ? parseFloat(((pc / total) * 100).toFixed(2)) : null,
              downloadGrowth: r.download_growth != null ? Number(r.download_growth) : null,
              growthRate: r.growth_rate != null ? Number(r.growth_rate) : null,
              crawledAt: r.crawled_at,
            };
          }),
        };
      },
    }
  );

  // ====== PC下载Top25明细列表（固定最近8小时） ======
  const pcTop25Sql = useMemo(() => buildPcTop25Sql(), []);

  const pcTop25Query = useChartData(
    'taptap-pc-top25-list',
    (p) => querySql(p.sql),
    { sql: pcTop25Sql },
    {
      transform: (rows) => {
        if (!rows || !rows.length) return { rows: [] };
        return {
          rows: rows.map((r) => ({
            appId: r.app_id,
            appName: r.app_name,
            downloadCount: r.pc_download_count != null ? Number(r.pc_download_count) : null,
            downloadGrowth: r.download_growth != null ? Number(r.download_growth) : null,
            growthRate: r.growth_rate != null ? Number(r.growth_rate) : null,
            crawledAt: r.crawled_at,
          })),
        };
      },
    }
  );

  // ====== 创意工坊下载Top25明细列表（固定最近8小时） ======
  const creativeTop25Sql = useMemo(() => buildCreativeTop25Sql(), []);

  const creativeTop25Query = useChartData(
    'taptap-creative-top25-list',
    (p) => querySql(p.sql),
    { sql: creativeTop25Sql },
    {
      transform: (rows) => {
        if (!rows || !rows.length) return { rows: [] };
        return {
          rows: rows.map((r) => ({
            appId: r.app_id,
            appName: r.app_name,
            downloadCount: r.download_count != null ? Number(r.download_count) : null,
            downloadGrowth: r.download_growth != null ? Number(r.download_growth) : null,
            growthRate: r.growth_rate != null ? Number(r.growth_rate) : null,
            crawledAt: r.crawled_at,
          })),
        };
      },
    }
  );

  // ====== 追踪的游戏分布（固定最近8小时） ======
  const distributionSql = useMemo(() => buildDistributionSql(), []);

  const distributionQuery = useChartData(
    'taptap-game-distribution',
    (p) => querySql(p.sql),
    { sql: distributionSql },
    {
      transform: (rows) => {
        if (!rows || !rows.length) return { series: [], labels: [], total: null };
        const r = rows[0];
        const pc = Number(r.pc_game_count || 0);
        const app = Number(r.app_game_count || 0);
        const ai = Number(r.ai_game_count || 0);
        return {
          series: [pc, app, ai],
          labels: ['PC游戏', 'APP游戏', '创意工坊游戏'],
          total: pc + app + ai,
        };
      },
    }
  );

  const detailEmpty = !validAppId || (detailQuery.isSuccess && !detailQuery.data?.series?.length);

  const top25Rows = top25Query.data?.rows || [];
  const top25TotalPages = Math.ceil(top25Rows.length / TOP25_PAGE_SIZE);
  const pagedTop25Rows = top25Rows.slice((top25Page - 1) * TOP25_PAGE_SIZE, top25Page * TOP25_PAGE_SIZE);

  const pcTop25Rows = pcTop25Query.data?.rows || [];
  const creativeTop25Rows = creativeTop25Query.data?.rows || [];

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
                formatter: (v) => {
                  if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(1) + '亿';
                  if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(1) + '万';
                  return v;
                },
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
                yaxisOverrides={{ title: { text: '下载数' }, labels: { formatter: (v) => (v >= 10000 ? (v / 10000).toFixed(1) + '万' : v) } }} />
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
                yaxisOverrides={{ title: { text: '下载数' }, labels: { formatter: (v) => (v >= 10000 ? (v / 10000).toFixed(1) + '万' : v) } }} />
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
            <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="text-center" style={{ width: 60 }}>#</th>
                  <th>AppID</th>
                  <th>游戏名称</th>
                  <th className="text-end">下载数</th>
                  <th className="text-end">PC下载数</th>
                  <th className="text-end">PC占比</th>
                  <th className="text-end">增长</th>
                  <th className="text-end">增长率</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {pagedTop25Rows.length ? (
                  pagedTop25Rows.map((row, idx) => {
                    const rank = (top25Page - 1) * TOP25_PAGE_SIZE + idx + 1;
                    return (
                    <tr key={idx}>
                      <td className="text-center" style={{ width: 60 }}>
                        {rank <= 3 ? (
                          <span className={`badge ${rank === 1 ? 'bg-warning text-dark' : rank === 2 ? 'bg-secondary' : 'bg-danger'}`}>{rank}</span>
                        ) : (
                          <span className="text-muted">{rank}</span>
                        )}
                      </td>
                      <td className="text-muted small">{row.appId}</td>
                      <td className="fw-semibold">{row.appName}</td>
                      <td className="text-end fw-semibold">{formatNumber(row.downloadCount)}</td>
                      <td className="text-end">{formatNumber(row.pcDownloadCount)}</td>
                      <td className="text-end">{row.pcRatio != null ? `${row.pcRatio}%` : '-'}</td>
                      <td className="text-end">
                        {row.downloadGrowth == null ? '-' : (
                          <span className={row.downloadGrowth > 0 ? 'text-success' : row.downloadGrowth < 0 ? 'text-danger' : ''}>
                            {row.downloadGrowth > 0 ? '+' : ''}{formatNumber(row.downloadGrowth)}
                          </span>
                        )}
                      </td>
                      <td className="text-end">
                        {row.growthRate == null ? '-' : (
                          <span className={row.growthRate > 0 ? 'text-success' : row.growthRate < 0 ? 'text-danger' : ''}>
                            {row.growthRate > 0 ? '+' : ''}{row.growthRate}%
                          </span>
                        )}
                      </td>
                      <td className="text-muted small">{row.crawledAt}</td>
                    </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="text-center text-muted py-4">暂无数据</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {top25TotalPages > 1 && (
            <div className="d-flex justify-content-center p-3">
              <nav><ul className="pagination pagination-sm mb-0">
                <li className={`page-item ${top25Page <= 1 ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setTop25Page((p) => Math.max(1, p - 1))}>上一页</button>
                </li>
                <li className="page-item disabled"><span className="page-link">{top25Page} / {top25TotalPages}</span></li>
                <li className={`page-item ${top25Page >= top25TotalPages ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setTop25Page((p) => Math.min(top25TotalPages, p + 1))}>下一页</button>
                </li>
              </ul></nav>
            </div>
          )}
        </div>
      </div>
      </div>
      </div>

      {/* PC下载Top25明细 + 创意工坊下载Top25明细（并排） */}
      <div className="row g-3 mb-4">
        <Top25DetailTable title="PC下载Top25明细 — 最近8小时" rows={pcTop25Rows} countHeader="PC下载数" />
        <Top25DetailTable title="创意工坊下载Top25明细 — 最近8小时" rows={creativeTop25Rows} countHeader="下载数" />
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

      {/* 游戏最新快照指标（历史累计值） */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-2"><DashboardCard title="PC下载数(历史)" value={latestQuery.data?.pcDownload != null ? formatNumber(latestQuery.data.pcDownload) : '-'} icon="bi-pc-display" color="primary" /></div>
        <div className="col-6 col-md-2"><DashboardCard title="移动下载数(历史)" value={latestQuery.data?.mobileDownload != null ? formatNumber(latestQuery.data.mobileDownload) : '-'} icon="bi-phone" color="info" /></div>
        <div className="col-6 col-md-2"><DashboardCard title="PC占比(历史)" value={latestQuery.data?.pcRatio != null ? `${latestQuery.data.pcRatio}%` : '-'} icon="bi-percent" color="success" /></div>
        <div className="col-6 col-md-2"><DashboardCard title="关注数(历史)" value={latestQuery.data?.fansCount != null ? formatNumber(latestQuery.data.fansCount) : '-'} icon="bi-heart" color="danger" /></div>
        <div className="col-6 col-md-2"><DashboardCard title="评价数(历史)" value={latestQuery.data?.reviewCount != null ? formatNumber(latestQuery.data.reviewCount) : '-'} icon="bi-chat" color="warning" /></div>
        <div className="col-6 col-md-2"><DashboardCard title="收藏数(历史)" value={latestQuery.data?.wishCount != null ? formatNumber(latestQuery.data.wishCount) : '-'} icon="bi-star" color="secondary" /></div>
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
