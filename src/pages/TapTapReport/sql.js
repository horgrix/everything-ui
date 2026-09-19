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

// ---- 可复用 SQL 片段 ----

/** 累计字段的增量（LAG 差分，按 app_id 分区） */
function lagDelta(field) {
  return `${field} - LAG(${field}) OVER (PARTITION BY app_id ORDER BY crawled_at) AS ${field}`;
}

/** 上一期累计值（LAG，按 app_id 分区），用于二次差分求增长 */
function lagPrev(expr) {
  return `LAG(${expr}) OVER (PARTITION BY app_id ORDER BY crawled_at) AS prev_download_count`;
}

/** 周期内增量（MAX-MIN 差分） */
function maxMinDelta(field) {
  return `MAX(${field}) - MIN(${field}) AS ${field}`;
}

/** 增长率公式（* 100.0 避免整数除法） */
const GROWTH_RATE = 'ROUND(download_growth * 100.0 / NULLIF(prev_download_count, 0), 2) AS growth_rate';

/** 创意工坊(AI)游戏：hits_total_val 为空但 hits_total 有效的部分 */
const AI_GAME_SUM = 'SUM(CASE WHEN hits_total_val IS NULL AND hits_total IS NOT NULL AND hits_total > 0 THEN hits_total ELSE 0 END) as ai_game_count';
const AI_GAME_COUNT = 'SUM(CASE WHEN hits_total_val IS NULL AND hits_total IS NOT NULL AND hits_total > 0 THEN 1 ELSE 0 END) as ai_game_count';

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
        ${lagDelta('pc_download_count')},
        ${lagDelta('hits_total')},
        ${lagDelta('hits_total_val')}
      FROM taptap_hot_list_game_hourly
      WHERE crawled_at >= '${dateStr}'
    ) t1
    GROUP BY crawled_at
    HAVING SUM(pc_download_count) + SUM(hits_total) > 0
    ORDER BY crawled_at
  `;
}

/** 构建详情增量 SQL（单游戏，按时间范围过滤） */
export function buildDetailSql(appId, days) {
  const dateStr = recentDaysWhere(days);
  return `
    SELECT
      app_id,
      app_name,
      crawled_at,
      ${lagDelta('pc_download_count')},
      ${lagDelta('hits_total')},
      ${lagDelta('hits_total_val')}
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
      ${maxMinDelta('pc_download_count')},
      ${maxMinDelta('hits_total')},
      ${maxMinDelta('fans_count')},
      ${maxMinDelta('review_count')},
      ${maxMinDelta('wish_count')}
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

/** 构建周期趋势 SQL（日/月共用，substrLen 决定聚合粒度，含创意工坊AI游戏计数） */
function buildPeriodTrendSql(substrLen, dateStr) {
  return `
    SELECT
      crawled_at,
      SUM(pc_download_count) as pc_download_count,
      SUM(hits_total) as hits_total,
      SUM(hits_total_val) as hits_total_val,
      ${AI_GAME_SUM}
    FROM (
      SELECT
        app_id,
        substr(crawled_at, 1, ${substrLen}) as crawled_at,
        ${maxMinDelta('pc_download_count')},
        ${maxMinDelta('hits_total')},
        ${maxMinDelta('hits_total_val')}
      FROM taptap_hot_list_game_hourly
      WHERE crawled_at >= '${dateStr}'
      GROUP BY app_id, substr(crawled_at, 1, ${substrLen})
    )
    GROUP BY crawled_at
    ORDER BY crawled_at
  `;
}

/** 构建日趋势 SQL（最近15天） */
export function buildDailyTrendSql() {
  return buildPeriodTrendSql(10, recentDaysWhere(15));
}

/** 构建月趋势 SQL（最近3个月） */
export function buildMonthlyTrendSql() {
  return buildPeriodTrendSql(7, recentMonthsWhere(3));
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
      ${GROWTH_RATE}
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
          ${lagPrev('pc_download_count + hits_total')}
        FROM (
          SELECT
            app_id,
            app_name,
            crawled_at,
            ${lagDelta('pc_download_count')},
            ${lagDelta('hits_total')}
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
      ${GROWTH_RATE}
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
          ${lagPrev('pc_download_count')}
        FROM (
          SELECT
            app_id,
            app_name,
            crawled_at,
            ${lagDelta('pc_download_count')}
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
      ${GROWTH_RATE}
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
          ${lagPrev('hits_total')}
        FROM (
          SELECT
            app_id,
            app_name,
            crawled_at,
            ${lagDelta('hits_total')}
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
      ${AI_GAME_COUNT}
    FROM taptap_hot_list_game_hourly
    WHERE crawled_at >= '${dateStr}'
    GROUP BY crawled_at
    ORDER BY crawled_at DESC
    LIMIT 1
  `;
}
