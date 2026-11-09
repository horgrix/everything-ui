import { recentHoursWhere } from '../../dates';

/**
 * 预约统计相关 SQL（预约趋势汇总 / 本日预约新增榜）
 */

/** 热门预约榜在榜游戏预约趋势 SQL（近 24 小时，SQLite 的 dws_taptap_reserve_summary_v2_hourly） */
export function buildReserveTrendSql() {
  return `
    SELECT
      crawled_at,
      reserve_count,
      game_conut
    FROM dws_taptap_reserve_summary_v2_hourly
    WHERE crawled_at >= '${recentHoursWhere(24)}'
    ORDER BY crawled_at
  `;
}

/**
 * 热门预约榜在榜游戏「本日预约新增 TopN」SQL
 * 数据源 SQLite 的 dws_taptap_reserve_v2_hourly：
 *   新增预约数按「今天」聚合 = SUM(reserve_count)；历史总预约数取今天最后一次快照的 total_reserve_count
 */
export function buildReserveTopSql(limit = 50, ref = new Date()) {
  const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const today = fmt(new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()));
  return `
    WITH today_rows AS (
      SELECT *
      FROM dws_taptap_reserve_v2_hourly
      WHERE crawled_at >= '${today} 00' AND crawled_at <= '${today} 23'
    ),
    latest AS (
      SELECT app_id, total_reserve_count, app_name, icon, tag_1, tag_2, tag_3, distribution_type, hints
      FROM today_rows
      WHERE crawled_at = (SELECT MAX(crawled_at) FROM today_rows)
    ),
    agg AS (
      SELECT app_id, SUM(reserve_count) AS daily_reserve_count, COUNT(*) AS point_cnt
      FROM today_rows
      GROUP BY app_id
    )
    SELECT
      a.app_id,
      l.app_name,
      l.icon,
      l.tag_1,
      l.tag_2,
      l.tag_3,
      l.distribution_type,
      l.hints,
      l.total_reserve_count,
      a.daily_reserve_count,
      a.point_cnt
    FROM agg a
    JOIN latest l ON l.app_id = a.app_id
    ORDER BY a.daily_reserve_count DESC
    LIMIT ${limit}
  `;
}

/** 本日预约新增趋势 SQL（TopN 名单在今天各快照下的 reserve_count） */
export function buildReserveTopTrendSql(limit = 50, ref = new Date()) {
  const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const today = fmt(new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()));
  return `
    WITH today_rows AS (
      SELECT *
      FROM dws_taptap_reserve_v2_hourly
      WHERE crawled_at >= '${today} 00' AND crawled_at <= '${today} 23'
    ),
    top_ids AS (
      SELECT app_id, SUM(reserve_count) AS daily_reserve_count
      FROM today_rows
      GROUP BY app_id
      ORDER BY daily_reserve_count DESC
      LIMIT ${limit}
    )
    SELECT t.app_id, t.crawled_at, t.reserve_count
    FROM today_rows t
    JOIN top_ids i ON i.app_id = t.app_id
    ORDER BY t.app_id, t.crawled_at
  `;
}
