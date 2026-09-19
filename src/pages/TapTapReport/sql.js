/** 最近 N 天 */
export function recentDaysWhere(days = 3) {
  const start = new Date(Date.now() - days * 86400000);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  const d = String(start.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 最近 N 小时 */
export function recentHoursWhere(hours) {
  const start = new Date(Date.now() - hours * 3600000);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  const d = String(start.getDate()).padStart(2, '0');
  const h = String(start.getHours()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}`;
}

/** 最近 N 个月的第一天 */
export function recentMonthsWhere(months) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - months, 1);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
}

/** 构建聚合增量 SQL（近48小时，按 crawled_at 汇总所有游戏增量） */
export function buildAggregateSql() {
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
export function buildDetailSql(appId, days) {
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
export function buildSummarySql(appId, days) {
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
export function buildLatestSql(appId) {
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

/** 构建日趋势 SQL（最近15天，含创意工坊AI游戏计数） */
export function buildDailyTrendSql() {
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
export function buildMonthlyTrendSql() {
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
export function buildTop25Sql() {
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
export function buildPcTop25Sql() {
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
export function buildCreativeTop25Sql() {
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
export function buildDistributionSql() {
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
