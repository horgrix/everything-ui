import { recentHoursWhere } from '../../dates';

/**
 * TapPC 在线人数相关 SQL（峰值榜 / 分布 / Top80）
 */

/** 构建TapPC在线人数趋势 SQL（最近24小时，分组堆叠柱状数据源） */
export function buildOnlinePlayersTrendSql() {
  return `
    SELECT
      crawled_at,
      biz_online_players,
      mini_game_online_players,
      tmk_online_players,
      biz_game_cnt,
      mini_game_cnt,
      tmk_game_cnt
    FROM dws_taptap_pc_online_peak_players_v2_hourly
    WHERE crawled_at >= '${recentHoursWhere(24)}'
    ORDER BY crawled_at
  `;
}

/** 构建TapPC热玩游戏榜在线人数历史统计 SQL（小于最近24小时的历史峰值最高/最低/均值） */
export function buildOnlinePlayersStatsSql() {
  return `
    SELECT
      MAX(online_players) AS max_online_players,
      MIN(online_players) AS min_online_players,
      AVG(online_players) AS avg_online_players
    FROM dws_taptap_pc_online_peak_players_hourly
    WHERE crawled_at < '${recentHoursWhere(24)}'
  `;
}

/** 构建TapPC在线玩家来源最新统计窗口 SQL */
export function buildOnlinePlayersSourceNewestSql() {
  return `
    SELECT MAX(crawled_at) AS newest_datestr
    FROM dws_taptap_pc_online_peak_players_details_hourly
  `;
}

/** 构建TapPC在线玩家分布第一层 SQL（按人数分桶的大类） */
export function buildOnlinePlayersSourceSql(dateStr) {
  return `
    SELECT
      CASE
        WHEN online_players < 100 THEN '在线人数[1-99]'
        WHEN online_players = 100 THEN '在线人数[=100]'
        WHEN online_players > 100 AND online_players <= 500 THEN '在线人数[100-500]'
        WHEN online_players > 500 AND online_players <= 1000 THEN '在线人数[500-1000]'
        WHEN online_players > 1000 AND online_players <= 5000 THEN '在线人数[1000-5000]'
        WHEN online_players > 5000 AND online_players <= 10000 THEN '在线人数[5000-10000]'
        ELSE '在线人数[10000+]'
      END AS player_bucket,
      COUNT(*) AS game_cnt,
      SUM(online_players) AS online_players
    FROM dws_taptap_pc_online_peak_players_details_hourly
    WHERE crawled_at = '${dateStr}'
    GROUP BY player_bucket
  `;
}

/** 构建TapPC在线玩家分布第二层 SQL（具体游戏明细） */
export function buildOnlinePlayersSourceGamesSql(dateStr) {
  return `
    SELECT
      app_name,
      online_players
    FROM dws_taptap_pc_online_peak_players_details_hourly
    WHERE crawled_at = '${dateStr}'
    ORDER BY online_players DESC
  `;
}

/** 构建TapPC在线峰值来源 SQL（最新窗口按 distribution_type 汇总：商业游戏 / 独立小游戏 / Maker小游戏） */
export function buildPcOnlinePeakSourceSql(dateStr) {
  return `
    SELECT
      distribution_type,
      COUNT(*) AS game_cnt,
      SUM(online_players) AS online_players
    FROM dws_taptap_pc_online_peak_players_details_hourly
    WHERE crawled_at = '${dateStr}'
    GROUP BY distribution_type
  `;
}

/** 构建TapPC峰值在线 KPI SQL（各指标的最大值及其发生的时间节点） */
export function buildPcOnlinePeakKpisSql() {
  // MySQL（v09）的 dws_taptap_pc_online_peak_players_v2_hourly：
  // 总最高在线 + 商业游戏 / 独立小游戏 / Maker小游戏 各自最高在线
  const table = 'dws_taptap_pc_online_peak_players_v2_hourly';
  const one = (key, col) =>
    `(SELECT '${key}' AS k, ${col} AS v, crawled_at AS at FROM ${table} ORDER BY ${col} DESC, crawled_at DESC LIMIT 1)`;
  return [
    one('online', 'online_players'),
    one('biz', 'biz_online_players'),
    one('mini', 'mini_game_online_players'),
    one('tmk', 'tmk_online_players'),
  ].join('\n    UNION ALL\n    ');
}

/** 构建TapPC在线峰值来源最新统计窗口 SQL */
export function buildPcOnlinePeakNewestSql() {
  return `
    SELECT MAX(crawled_at) AS newest_datestr
    FROM dws_taptap_pc_online_peak_players_details_hourly
  `;
}

/** 构建TapPC在线人数Top80游戏列表 SQL（最新窗口，按 online_players 取前 80） */
export function buildPcOnlineTop80ListSql(dateStr) {
  const where = dateStr
    ? `crawled_at = '${dateStr}'`
    : `crawled_at = (SELECT MAX(crawled_at) FROM dws_taptap_pc_online_peak_players_details_hourly)`;
  return `
    SELECT
      app_id,
      app_name,
      icon,
      tag_1,
      tag_2,
      tag_3,
      distribution_type,
      online_players
    FROM dws_taptap_pc_online_peak_players_details_hourly
    WHERE ${where}
    ORDER BY online_players DESC
    LIMIT 80
  `;
}

/** 构建TapPC在线人数Top80游戏最近24小时趋势 SQL（仅取最新窗口 Top80 的 app_id） */
export function buildPcOnlineTop80TrendSql() {
  const dateStr = recentHoursWhere(24);
  return `
    SELECT
      d.app_id,
      d.crawled_at,
      d.online_players
    FROM dws_taptap_pc_online_peak_players_details_hourly d
    WHERE d.crawled_at >= '${dateStr}'
      AND d.app_id IN (
        SELECT app_id
        FROM dws_taptap_pc_online_peak_players_details_hourly
        WHERE crawled_at = (SELECT MAX(crawled_at) FROM dws_taptap_pc_online_peak_players_details_hourly)
        ORDER BY online_players DESC
        LIMIT 80
      )
    ORDER BY d.app_id, d.crawled_at
  `;
}
