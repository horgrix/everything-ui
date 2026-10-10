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

/** 构建聚合下载 SQL（近24小时，按 crawled_at 汇总下载量，忽略0值） */
export function buildAggregateSql() {
  const dateStr = recentHoursWhere(24);
  return `
    SELECT
      crawled_at,
      SUM(download_count) as download_count,
      SUM(CASE WHEN refer = 'pc' THEN download_count ELSE 0 END) as pc_download_count,
      SUM(CASE WHEN refer = 'app' THEN download_count ELSE 0 END) as app_download_count
    FROM dws_taptap_download_hourly
    WHERE crawled_at >= '${dateStr}'
    GROUP BY crawled_at
    HAVING SUM(download_count) > 0
    ORDER BY crawled_at
  `;
}

/** 根据时间范围映射到下载明细表 */
function tableForDays(days) {
  if (days <= 3) return 'dws_taptap_download_hourly';
  if (days <= 30) return 'dws_taptap_download_daily';
  return 'dws_taptap_download_monthly';
}

/** 构建详情趋势 SQL（单游戏，按时间范围选表，受查询条件约束） */
export function buildDetailSql(appId, days) {
  const dateStr = recentDaysWhere(days);
  const table = tableForDays(days);
  if (table === 'dws_taptap_download_hourly') {
    return `
      SELECT
        crawled_at,
        SUM(download_count) as download_count,
        SUM(CASE WHEN refer = 'pc' THEN download_count ELSE 0 END) as pc_download_count,
        SUM(CASE WHEN refer = 'app' THEN download_count ELSE 0 END) as app_download_count
      FROM ${table}
      WHERE crawled_at > '${dateStr}'
        AND app_id = ${appId}
      GROUP BY crawled_at
      ORDER BY crawled_at
    `;
  }
  return `
    SELECT
      crawled_at,
      download_count,
      pc_download_count,
      app_download_count
    FROM ${table}
    WHERE crawled_at > '${dateStr}'
      AND app_id = ${appId}
    ORDER BY crawled_at
  `;
}

/** 构建汇总指标 SQL（单游戏，按时间范围选表，汇总下载量） */
export function buildSummarySql(appId, days) {
  const dateStr = recentDaysWhere(days);
  const table = tableForDays(days);
  if (table === 'dws_taptap_download_hourly') {
    return `
      SELECT
        SUM(download_count) as download_count,
        SUM(CASE WHEN refer = 'pc' THEN download_count ELSE 0 END) as pc_download_count,
        SUM(CASE WHEN refer = 'app' THEN download_count ELSE 0 END) as app_download_count
      FROM ${table}
      WHERE crawled_at > '${dateStr}'
        AND app_id = ${appId}
    `;
  }
  return `
    SELECT
      SUM(download_count) as download_count,
      SUM(pc_download_count) as pc_download_count,
      SUM(app_download_count) as app_download_count
    FROM ${table}
    WHERE crawled_at > '${dateStr}'
      AND app_id = ${appId}
  `;
}

/** 构建下载汇总 SQL（日/月共用，按 crawled_at 汇总平台/AI/TapMaker 下载量，忽略0值） */
function buildDownloadSummarySql(table, dateStr) {
  return `
    SELECT
      crawled_at,
      SUM(download_count) as download_count,
      SUM(pc_download_count) as pc_download_count,
      SUM(app_download_count) as app_download_count,
      SUM(none_ai_download_count) as none_ai_download_count,
      SUM(ai_download_count) as ai_download_count,
      SUM(ai_none_maker_download_count) as ai_none_maker_download_count,
      SUM(ai_maker_download_count) as ai_maker_download_count
    FROM ${table}
    WHERE crawled_at >= '${dateStr}'
    GROUP BY crawled_at
    HAVING SUM(download_count) > 0
    ORDER BY crawled_at
  `;
}

/** 构建日趋势 SQL（最近30天） */
export function buildDailyTrendSql() {
  return buildDownloadSummarySql('dws_taptap_download_daily', recentDaysWhere(30));
}

/** 构建月趋势明细 SQL（最近12个月） */
export function buildMonthlyBreakdownSql() {
  return buildDownloadSummarySql('dws_taptap_download_monthly', recentMonthsWhere(12));
}

/** 构建追踪的游戏分布 SQL（按窗口类型/统计窗口，受查询条件约束） */
export function buildDistributionByWindowSql(table, windowStr) {
  if (table === 'dws_taptap_download_hourly') {
    return `
      SELECT
        crawled_at,
        COUNT(*) as trace_game_count,
        SUM(CASE WHEN refer = 'pc' THEN 1 ELSE 0 END) as pc_game_count,
        SUM(CASE WHEN refer = 'app' THEN 1 ELSE 0 END) as app_game_count,
        SUM(CASE WHEN distribution_type = 0 THEN 1 ELSE 0 END) as none_ai_game_count,
        SUM(CASE WHEN distribution_type > 0 THEN 1 ELSE 0 END) as ai_game_count,
        SUM(CASE WHEN distribution_type = 1 THEN 1 ELSE 0 END) as ai_none_maker_game_count,
        SUM(CASE WHEN distribution_type = 2 THEN 1 ELSE 0 END) as ai_maker_game_count
      FROM ${table}
      WHERE crawled_at = '${windowStr}'
      GROUP BY crawled_at
      ORDER BY crawled_at
    `;
  }
  return `
    SELECT
      crawled_at,
      COUNT(*) as trace_game_count,
      SUM(CASE WHEN pc_download_count > 0 THEN 1 ELSE 0 END) as pc_game_count,
      SUM(CASE WHEN app_download_count > 0 THEN 1 ELSE 0 END) as app_game_count,
      SUM(CASE WHEN none_ai_download_count > 0 THEN 1 ELSE 0 END) as none_ai_game_count,
      SUM(CASE WHEN ai_download_count > 0 THEN 1 ELSE 0 END) as ai_game_count,
      SUM(CASE WHEN ai_none_maker_download_count > 0 THEN 1 ELSE 0 END) as ai_none_maker_game_count,
      SUM(CASE WHEN ai_maker_download_count > 0 THEN 1 ELSE 0 END) as ai_maker_game_count
    FROM ${table}
    WHERE crawled_at = '${windowStr}'
    GROUP BY crawled_at
    ORDER BY crawled_at
  `;
}

/** 构建下载Top25明细 SQL（按窗口类型/统计窗口 + 过滤条件，受查询条件约束） */
export function buildTop25DetailSql(table, windowStr, hourFilter, dayFilter, orderBy) {
  if (table === 'dws_taptap_download_hourly') {
    return `
      SELECT
        app_id,
        crawled_at,
        refer,
        distribution_type,
        download_count
      FROM ${table}
      WHERE crawled_at = '${windowStr}'
        AND ${hourFilter}
      ORDER BY download_count DESC
      LIMIT 25
    `;
  }
  return `
    SELECT
      app_id,
      crawled_at,
      ${orderBy} as download_count
    FROM ${table}
    WHERE crawled_at = '${windowStr}'
      AND ${dayFilter}
    ORDER BY ${orderBy} DESC
    LIMIT 25
  `;
}

/** 构建游戏名称映射 SQL（当前月份） */
export function buildGameNameSql() {
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `
    SELECT app_id, app_name
    FROM dws_taptap_game
    WHERE crawled_at = '${monthStr}'
  `;
}

/** 构建TapPC在线人数趋势 SQL（最近24小时，分组堆叠柱状数据源） */
export function buildOnlinePlayersTrendSql() {
  return `
    SELECT
      crawled_at,
      pc_online_players,
      pc_emulator_online_players,
      creative_non_online_players,
      creative_mk_online_players,
      stat_pc_game_cnt,
      stat_pc_emulator_game_cnt,
      stat_creative_non_game_cnt,
      stat_creative_mk_game_cnt
    FROM dws_taptap_pc_online_peak_players_hourly
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

/** 构建最新数据时间 SQL（用于避免数据更新期间空白） */
export function buildNewestDateSql() {
  const dateStr = recentDaysWhere(7);
  return `
    SELECT MAX(crawled_at) AS newest_datestr
    FROM dws_taptap_download_hourly
    WHERE crawled_at >= '${dateStr}'
  `;
}

/** 构建TapPC在线玩家来源最新统计窗口 SQL */
export function buildOnlinePlayersSourceNewestSql() {
  return `
    SELECT MAX(crawled_at) AS newest_datestr
    FROM taptap_pc_online_players
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
    FROM taptap_pc_online_players
    WHERE crawled_at = '${dateStr}'
    GROUP BY player_bucket
  `;
}

/** 构建TapPC在线玩家分布第二层 SQL（具体游戏明细） */
export function buildOnlinePlayersSourceGamesSql(dateStr) {
  return `
    SELECT
      b.app_name AS app_name,
      a.online_players AS online_players
    FROM (
      SELECT app_id, online_players
      FROM taptap_pc_online_players
      WHERE crawled_at = '${dateStr}'
    ) a
    LEFT JOIN (
      SELECT * FROM taptap_pc_played_ids_daily
      WHERE crawled_at = strftime('%Y-%m-%d', 'now', 'localtime')
    ) b ON a.app_id = b.app_id
    ORDER BY a.online_players DESC
  `;
}

/** 构建TapPC在线峰值来源在线人数 SQL（最新一行全量汇总，三个来源在线人数） */
export function buildPcOnlinePeakSourceSql() {
  return `
    SELECT
      pc_online_players,
      pc_emulator_online_players,
      creative_online_players,
      crawled_at
    FROM dws_taptap_pc_online_peak_players_hourly
    ORDER BY crawled_at DESC
    LIMIT 1
  `;
}

/** 构建TapPC在线人数总量 SQL（最新一行；总在线人数 + 各来源在线人数，用于计算贡献度） */
export function buildPcOnlinePeakTotalsSql() {
  return `
    SELECT
      online_players,
      pc_online_players,
      pc_emulator_online_players,
      creative_online_players
    FROM dws_taptap_pc_online_peak_players_hourly
    ORDER BY crawled_at DESC
    LIMIT 1
  `;
}

/** 构建TapPC在线峰值来源最新统计窗口 SQL */
export function buildPcOnlinePeakNewestSql() {
  return `
    SELECT MAX(crawled_at) AS newest_datestr
    FROM dws_taptap_pc_online_peak_players_rank_hourly
  `;
}

/** 构建TapPC在线峰值来源游戏明细 SQL（最新窗口，按来源分组，游戏按在线人数降序） */
export function buildPcOnlinePeakRankSql() {
  return `
    SELECT
      list_type,
      app_name,
      online_players
    FROM dws_taptap_pc_online_peak_players_rank_hourly
    WHERE crawled_at = (SELECT MAX(crawled_at) FROM dws_taptap_pc_online_peak_players_rank_hourly)
    ORDER BY list_type, online_players DESC
  `;
}

/** 构建TapPC在线人数Top20游戏列表 SQL（最新统计窗口，筛选 list_type_rk<=20） */
export function buildPcOnlineTop20ListSql() {
  return `
    SELECT
      app_id,
      app_name,
      tag_1,
      tag_2,
      tag_3,
      list_type,
      distribution_type,
      online_players,
      list_type_rk
    FROM dws_taptap_pc_online_peak_players_rank_hourly
    WHERE crawled_at = (SELECT MAX(crawled_at) FROM dws_taptap_pc_online_peak_players_rank_hourly)
      AND list_type_rk <= 20
    ORDER BY online_players DESC
  `;
}

/** 构建TapPC在线人数Top20游戏最近24小时趋势 SQL（仅取最新窗口 Top20 的 app_id+list_type） */
export function buildPcOnlineTop20TrendSql() {
  const dateStr = recentHoursWhere(24);
  return `
    SELECT
      r.app_id,
      r.list_type,
      r.crawled_at,
      r.online_players
    FROM dws_taptap_pc_online_peak_players_rank_hourly r
    WHERE r.crawled_at >= '${dateStr}'
      AND EXISTS (
        SELECT 1
        FROM dws_taptap_pc_online_peak_players_rank_hourly t
        WHERE t.app_id = r.app_id
          AND t.list_type = r.list_type
          AND t.list_type_rk <= 20
          AND t.crawled_at = (SELECT MAX(crawled_at) FROM dws_taptap_pc_online_peak_players_rank_hourly)
      )
    ORDER BY r.app_id, r.list_type, r.crawled_at
  `;
}

/** 构建TapPC广告每日新发现广告位统计 SQL（最近7天，按日+position 聚合广告加载率，只看前20个固定位置） */
export function buildAdNewPositionStatsSql() {
  const dateStr = recentDaysWhere(7);
  return `
    SELECT
      crawled_at,
      position,
      show_cnt,
      ad_cnt,
      ROUND(ad_cnt * 1.0 / show_cnt, 2) AS ad_loading_rate
    FROM (
      SELECT
        substr(crawled_at, 1, 10) AS crawled_at,
        position,
        COUNT(*) AS show_cnt,
        SUM(CASE WHEN is_ad = 'True' THEN 1 ELSE 0 END) AS ad_cnt
      FROM taptap_ad_loading_hourly
      WHERE crawled_at > '${dateStr}'
        AND ad_type = 'tappc_2671'
        AND position <= 20
      GROUP BY substr(crawled_at, 1, 10), position
    ) t
  `;
}

/** 构建TapPC广告投放素材分布第一层 SQL（最近7天，合并tag_1/tag_2/tag_3为大类tag，聚合广告加载率） */
export function buildAdMaterialTagsSql() {
  const dateStr = recentDaysWhere(7);
  return `
    SELECT
      tag,
      show_cnt,
      ad_cnt,
      ROUND(ad_cnt * 1.0 / show_cnt, 2) AS ad_loading_rate
    FROM (
      SELECT
        tag,
        SUM(show_cnt) AS show_cnt,
        SUM(ad_cnt) AS ad_cnt
      FROM (
        SELECT
          tag_1 AS tag,
          COUNT(*) AS show_cnt,
          SUM(CASE WHEN is_ad = 'True' THEN 1 ELSE 0 END) AS ad_cnt
        FROM taptap_ad_loading_hourly
        WHERE crawled_at > '${dateStr}'
          AND ad_type = 'tappc_2671'
          AND position <= 20
          AND tag_1 IS NOT NULL
        GROUP BY tag_1
        UNION ALL
        SELECT
          tag_2 AS tag,
          COUNT(*) AS show_cnt,
          SUM(CASE WHEN is_ad = 'True' THEN 1 ELSE 0 END) AS ad_cnt
        FROM taptap_ad_loading_hourly
        WHERE crawled_at > '${dateStr}'
          AND ad_type = 'tappc_2671'
          AND position <= 20
          AND tag_2 IS NOT NULL
        GROUP BY tag_2
        UNION ALL
        SELECT
          tag_3 AS tag,
          COUNT(*) AS show_cnt,
          SUM(CASE WHEN is_ad = 'True' THEN 1 ELSE 0 END) AS ad_cnt
        FROM taptap_ad_loading_hourly
        WHERE crawled_at > '${dateStr}'
          AND ad_type = 'tappc_2671'
          AND position <= 20
          AND tag_3 IS NOT NULL
        GROUP BY tag_3
      ) u
      GROUP BY tag
    ) t
  `;
}

/** 构建TapPC广告投放素材分布第二层 SQL（最近7天，按合并后的tag+app_id聚合广告加载次数） */
export function buildAdMaterialGamesSql() {
  const dateStr = recentDaysWhere(7);
  return `
    SELECT
      tag,
      app_id,
      MAX(app_name) AS app_name,
      SUM(loaded_cnt) AS loaded_cnt
    FROM (
      SELECT
        tag_1 AS tag,
        app_id,
        app_name,
        COUNT(*) AS loaded_cnt
      FROM taptap_ad_loading_hourly
      WHERE crawled_at > '${dateStr}'
        AND ad_type = 'tappc_2671'
        AND is_ad = 'True'
        AND tag_1 IS NOT NULL
        AND position <= 20
      GROUP BY tag_1, app_id, app_name
      UNION ALL
      SELECT
        tag_2 AS tag,
        app_id,
        app_name,
        COUNT(*) AS loaded_cnt
      FROM taptap_ad_loading_hourly
      WHERE crawled_at > '${dateStr}'
        AND ad_type = 'tappc_2671'
        AND is_ad = 'True'
        AND tag_2 IS NOT NULL
        AND position <= 20
      GROUP BY tag_2, app_id, app_name
      UNION ALL
      SELECT
        tag_3 AS tag,
        app_id,
        app_name,
        COUNT(*) AS loaded_cnt
      FROM taptap_ad_loading_hourly
      WHERE crawled_at > '${dateStr}'
        AND ad_type = 'tappc_2671'
        AND is_ad = 'True'
        AND tag_3 IS NOT NULL
        AND position <= 20
      GROUP BY tag_3, app_id, app_name
    ) u
    GROUP BY tag, app_id
  `;
}

/** 构建TapPC广告游戏列表 SQL（最近7天，按app_id聚合曝光/广告次数，合并重复的app_name） */
export function buildAdGameListSql() {
  const dateStr = recentDaysWhere(7);
  return `
    SELECT
      app_id,
      MAX(app_name) AS app_name,
      MAX(tag_1) AS tag_1,
      MAX(tag_2) AS tag_2,
      MAX(tag_3) AS tag_3,
      COUNT(*) AS show_cnt,
      SUM(CASE WHEN is_ad = 'True' THEN 1 ELSE 0 END) AS ad_cnt
    FROM taptap_ad_loading_hourly
    WHERE crawled_at > '${dateStr}'
      AND ad_type = 'tappc_2671'
    GROUP BY app_id
    ORDER BY ad_cnt DESC, show_cnt DESC
  `;
}

/** 构建TapPC广告每日投放趋势 SQL（最近7天，按app_id+日聚合广告投放次数） */
export function buildAdGameDailyTrendSql() {
  const dateStr = recentDaysWhere(7);
  return `
    SELECT
      app_id,
      substr(crawled_at, 1, 10) AS day,
      SUM(CASE WHEN is_ad = 'True' THEN 1 ELSE 0 END) AS ad_cnt
    FROM taptap_ad_loading_hourly
    WHERE crawled_at > '${dateStr}'
      AND ad_type = 'tappc_2671'
    GROUP BY app_id, substr(crawled_at, 1, 10)
    ORDER BY app_id, day
  `;
}

/** 构建TapPC广告总曝光/总广告次数 SQL（最近7天） */
export function buildAdTotalStatsSql() {
  const dateStr = recentDaysWhere(7);
  return `
    SELECT
      COUNT(*) AS total_show_cnt,
      SUM(CASE WHEN is_ad = 'True' THEN 1 ELSE 0 END) AS total_ad_cnt
    FROM taptap_ad_loading_hourly
    WHERE crawled_at > '${dateStr}'
      AND ad_type = 'tappc_2671'
  `;
}

/** 构建TapPC广告每日加载率趋势 SQL（最近7天，按日聚合曝光/广告次数与加载率） */
export function buildAdLoadingRateTrendSql() {
  const dateStr = recentDaysWhere(7);
  return `
    SELECT
      crawled_at,
      show_cnt,
      ad_cnt,
      ROUND(ad_cnt * 1.0 / show_cnt, 2) AS ad_loading_rate
    FROM (
      SELECT
        substr(crawled_at, 1, 10) AS crawled_at,
        COUNT(*) AS show_cnt,
        SUM(CASE WHEN is_ad = 'True' THEN 1 ELSE 0 END) AS ad_cnt
      FROM taptap_ad_loading_hourly
      WHERE crawled_at > '${dateStr}'
        AND ad_type = 'tappc_2671'
      GROUP BY substr(crawled_at, 1, 10)
    ) t
  `;
}

/* ===== TapApp 首页找游戏广告（landing）===== */

/** 首页找游戏广告 iOS+Android UNION ALL 基础子查询（仅公共字段，is_ad 判定用 'True'，position<=20） */
function tapAppLandingBase(dateStr) {
  return `
    SELECT tag_1, tag_2, tag_3, distribution_type, app_name, app_id, position, is_ad, crawled_at, 'ios' AS platform
    FROM taptap_app_ios_landing_ad_hourly
    WHERE crawled_at > '${dateStr}' AND position <= 20
    UNION ALL
    SELECT tag_1, tag_2, tag_3, distribution_type, app_name, app_id, position, is_ad, crawled_at, 'android' AS platform
    FROM taptap_app_android_landing_ad_hourly
    WHERE crawled_at > '${dateStr}' AND position <= 20
  `;
}

/** 构建TapApp首页找游戏广告位统计 SQL（仅当天，按 platform+position 聚合广告加载率，只看前20个固定位置） */
export function buildTapAppAdNewPositionStatsSql() {
  const dateStr = recentDaysWhere(0);
  return `
    SELECT
      platform,
      position,
      show_cnt,
      ad_cnt,
      ROUND(ad_cnt * 1.0 / show_cnt, 2) AS ad_loading_rate
    FROM (
      SELECT
        platform,
        position,
        COUNT(*) AS show_cnt,
        SUM(CASE WHEN is_ad = 'True' THEN 1 ELSE 0 END) AS ad_cnt
      FROM (${tapAppLandingBase(dateStr)}) b
      GROUP BY platform, position
    ) t
  `;
}

/** 构建TapApp首页找游戏广告投放素材分布第一层 SQL（最近30天，dws日汇总表合并tag_1/tag_2/tag_3为大类tag，聚合广告加载率） */
export function buildTapAppAdMaterialTagsSql() {
  const dateStr = recentDaysWhere(30);
  return `
    SELECT
      tag,
      show_cnt,
      ad_cnt,
      ROUND(ad_cnt * 1.0 / show_cnt, 2) AS ad_loading_rate
    FROM (
      SELECT
        tag,
        SUM(show_cnt) AS show_cnt,
        SUM(ad_cnt) AS ad_cnt
      FROM (
        SELECT
          tag_1 AS tag,
          SUM(total_views) AS show_cnt,
          SUM(ad_views) AS ad_cnt
        FROM dws_taptap_app_landing_ad_daily
        WHERE crawled_at > '${dateStr}' AND tag_1 IS NOT NULL
        GROUP BY tag_1
        UNION ALL
        SELECT
          tag_2 AS tag,
          SUM(total_views) AS show_cnt,
          SUM(ad_views) AS ad_cnt
        FROM dws_taptap_app_landing_ad_daily
        WHERE crawled_at > '${dateStr}' AND tag_2 IS NOT NULL
        GROUP BY tag_2
        UNION ALL
        SELECT
          tag_3 AS tag,
          SUM(total_views) AS show_cnt,
          SUM(ad_views) AS ad_cnt
        FROM dws_taptap_app_landing_ad_daily
        WHERE crawled_at > '${dateStr}' AND tag_3 IS NOT NULL
        GROUP BY tag_3
      ) u
      GROUP BY tag
    ) t
  `;
}

/** 构建TapApp首页找游戏广告投放素材分布第二层 SQL（最近30天，dws日汇总表按合并后的tag+app_id聚合广告加载次数） */
export function buildTapAppAdMaterialGamesSql() {
  const dateStr = recentDaysWhere(30);
  return `
    SELECT
      tag,
      app_id,
      MAX(app_name) AS app_name,
      SUM(loaded_cnt) AS loaded_cnt
    FROM (
      SELECT
        tag_1 AS tag,
        app_id,
        app_name,
        SUM(ad_views) AS loaded_cnt
      FROM dws_taptap_app_landing_ad_daily
      WHERE crawled_at > '${dateStr}' AND tag_1 IS NOT NULL
      GROUP BY tag_1, app_id, app_name
      UNION ALL
      SELECT
        tag_2 AS tag,
        app_id,
        app_name,
        SUM(ad_views) AS loaded_cnt
      FROM dws_taptap_app_landing_ad_daily
      WHERE crawled_at > '${dateStr}' AND tag_2 IS NOT NULL
      GROUP BY tag_2, app_id, app_name
      UNION ALL
      SELECT
        tag_3 AS tag,
        app_id,
        app_name,
        SUM(ad_views) AS loaded_cnt
      FROM dws_taptap_app_landing_ad_daily
      WHERE crawled_at > '${dateStr}' AND tag_3 IS NOT NULL
      GROUP BY tag_3, app_id, app_name
    ) u
    GROUP BY tag, app_id
    HAVING SUM(loaded_cnt) > 0
  `;
}

/** 构建TapApp首页找游戏广告游戏列表 SQL（最近30天，dws日汇总表按app_id聚合） */
export function buildTapAppAdGameListSql() {
  const dateStr = recentDaysWhere(30);
  return `
    SELECT
      app_id,
      MAX(app_name) AS app_name,
      MAX(tag_1) AS tag_1,
      MAX(tag_2) AS tag_2,
      MAX(tag_3) AS tag_3,
      MAX(distribution_type) AS distribution_type,
      SUM(total_views) AS show_cnt,
      SUM(ios_views) AS ios_show_cnt,
      SUM(android_views) AS android_show_cnt,
      SUM(ad_views) AS ad_cnt,
      SUM(ios_ad_views) AS ios_ad_cnt,
      SUM(android_ad_views) AS android_ad_cnt
    FROM dws_taptap_app_landing_ad_daily
    WHERE crawled_at > '${dateStr}'
    GROUP BY app_id
    ORDER BY ad_cnt DESC, show_cnt DESC
    LIMIT 100
  `;
}

/** 构建TapApp首页找游戏广告每日投放趋势 SQL（最近30天，dws日汇总表按app_id+日聚合广告投放次数） */
export function buildTapAppAdGameDailyTrendSql() {
  const dateStr = recentDaysWhere(30);
  return `
    SELECT
      app_id,
      crawled_at AS day,
      SUM(ad_views) AS ad_cnt
    FROM dws_taptap_app_landing_ad_daily
    WHERE crawled_at > '${dateStr}'
    GROUP BY app_id, crawled_at
    ORDER BY app_id, day
  `;
}

/** 构建TapApp首页找游戏广告总计 SQL（最近30天，overview总览表汇总） */
export function buildTapAppAdOverviewStatsSql() {
  const dateStr = recentDaysWhere(30);
  return `
    SELECT
      SUM(total_views) AS total_views,
      SUM(ios_views) AS ios_views,
      SUM(android_views) AS android_views,
      SUM(ad_views) AS ad_views,
      SUM(ios_ad_views) AS ios_ad_views,
      SUM(android_ad_views) AS android_ad_views
    FROM dws_taptap_app_landing_ad_overview
    WHERE crawled_at > '${dateStr}'
  `;
}

/** 构建TapApp首页找游戏广告每日总投放趋势 SQL（最近30天，overview总览表按日汇总） */
export function buildTapAppAdOverviewDailyTrendSql() {
  const dateStr = recentDaysWhere(30);
  return `
    SELECT
      crawled_at AS day,
      SUM(ad_views) AS ad_cnt
    FROM dws_taptap_app_landing_ad_overview
    WHERE crawled_at > '${dateStr}'
    GROUP BY crawled_at
    ORDER BY day
  `;
}

/** 构建TapApp首页找游戏广告投放排名 SQL（本日/本周/本月，命中当前周期的排名） */
export function buildTapAppAdRankSql() {
  return `
    SELECT
      app_id,
      rank_type,
      ad_views_rank
    FROM dws_taptap_app_landing_ad_rank
    WHERE (rank_type = 'daily' AND crawled_at = strftime('%Y-%m-%d', 'now', 'localtime'))
       OR (rank_type = 'weekly' AND crawled_at = strftime('%Y-%W', 'now', 'localtime'))
       OR (rank_type = 'monthly' AND crawled_at = strftime('%Y-%m', 'now', 'localtime'))
  `;
}

/** 构建TapApp首页找游戏广告总曝光/总广告次数 SQL（最近7天） */
export function buildTapAppAdTotalStatsSql() {
  const dateStr = recentDaysWhere(7);
  return `
    SELECT
      COUNT(*) AS total_show_cnt,
      SUM(CASE WHEN is_ad = 'True' THEN 1 ELSE 0 END) AS total_ad_cnt
    FROM (${tapAppLandingBase(dateStr)}) b
  `;
}

/** 构建TapApp首页找游戏广告每日加载率趋势 SQL（最近30天，dws日汇总表按日聚合曝光/广告次数与加载率） */
export function buildTapAppAdLoadingRateTrendSql() {
  const dateStr = recentDaysWhere(30);
  return `
    SELECT
      crawled_at,
      show_cnt,
      ad_cnt,
      ROUND(ad_cnt * 1.0 / show_cnt, 2) AS ad_loading_rate
    FROM (
      SELECT
        crawled_at,
        SUM(total_views) AS show_cnt,
        SUM(ad_views) AS ad_cnt
      FROM dws_taptap_app_landing_ad_daily
      WHERE crawled_at > '${dateStr}'
      GROUP BY crawled_at
    ) t
  `;
}

/** 构建TapApp首页找游戏广告加载率趋势 SQL（最近24小时，overview 小时汇总表按小时取曝光/广告次数） */
export function buildTapAppAdOverviewHourlyTrendSql() {
  const dateStr = recentHoursWhere(24);
  return `
    SELECT
      crawled_at,
      total_views,
      ios_views,
      android_views,
      ad_views,
      ios_ad_views,
      android_ad_views
    FROM dws_taptap_app_landing_ad_overview_hourly
    WHERE crawled_at >= '${dateStr}'
    ORDER BY crawled_at
  `;
}

/* ===== TapApp 搜索页广告（search）===== */

/** 搜索页广告 6 表 UNION ALL 基础子查询（is_ad 判定用 'ad'，加 source 列区分 discovery/hot_search/hot_spot） */
function tapAppSearchBase(dateStr) {
  return `
    SELECT keyword, app_id, position, is_ad, crawled_at, 'discovery' AS source, 'ios' AS platform
    FROM taptap_app_ios_search_discovery_ad_hourly
    WHERE crawled_at > '${dateStr}'
    UNION ALL
    SELECT keyword, app_id, position, is_ad, crawled_at, 'hot_search' AS source, 'ios' AS platform
    FROM taptap_app_ios_search_hot_search_ad_hourly
    WHERE crawled_at > '${dateStr}'
    UNION ALL
    SELECT keyword, app_id, position, is_ad, crawled_at, 'hot_spot' AS source, 'ios' AS platform
    FROM taptap_app_ios_search_hot_spot_ad_hourly
    WHERE crawled_at > '${dateStr}'
    UNION ALL
    SELECT keyword, app_id, position, is_ad, crawled_at, 'discovery' AS source, 'android' AS platform
    FROM taptap_app_android_search_discovery_ad_hourly
    WHERE crawled_at > '${dateStr}'
    UNION ALL
    SELECT keyword, app_id, position, is_ad, crawled_at, 'hot_search' AS source, 'android' AS platform
    FROM taptap_app_android_search_hot_search_ad_hourly
    WHERE crawled_at > '${dateStr}'
    UNION ALL
    SELECT keyword, app_id, position, is_ad, crawled_at, 'hot_spot' AS source, 'android' AS platform
    FROM taptap_app_android_search_hot_spot_ad_hourly
    WHERE crawled_at > '${dateStr}'
  `;
}

/** 构建TapApp搜索页广告位统计 SQL（当天，按source+platform+position聚合广告加载率，仅前10个位置） */
export function buildTapAppSearchPositionStatsSql() {
  const dateStr = recentDaysWhere(0);
  return `
    SELECT
      source,
      platform,
      position,
      show_cnt,
      ad_cnt,
      ROUND(ad_cnt * 1.0 / show_cnt, 2) AS ad_loading_rate
    FROM (
      SELECT
        source,
        platform,
        position,
        COUNT(*) AS show_cnt,
        SUM(CASE WHEN is_ad = 'ad' THEN 1 ELSE 0 END) AS ad_cnt
      FROM (${tapAppSearchBase(dateStr)}) b
      WHERE position <= 10
      GROUP BY source, platform, position
    ) t
  `;
}

/** 构建TapApp搜索页广告每日加载率趋势 SQL（最近30天，overview总览表按日直接取值） */
export function buildTapAppSearchLoadingRateTrendSql() {
  const dateStr = recentDaysWhere(30);
  return `
    SELECT
      crawled_at,
      total_views AS show_cnt,
      ad_views AS ad_cnt,
      ROUND(ad_views * 1.0 / total_views, 2) AS ad_loading_rate
    FROM dws_taptap_app_keywords_ad_overview
    WHERE crawled_at > '${dateStr}'
    ORDER BY crawled_at
  `;
}

/** 构建TapApp搜索页关键词广告统计 SQL（最近7天，dws日汇总表按source+keyword聚合，3来源UNION ALL统一别名） */
export function buildTapAppSearchKeywordStatsSql() {
  const dateStr = recentDaysWhere(7);
  return `
    SELECT
      source,
      keyword,
      show_cnt,
      ios_show_cnt,
      android_show_cnt,
      ad_cnt,
      ios_ad_cnt,
      android_ad_cnt
    FROM (
      SELECT
        'discovery' AS source,
        keyword,
        SUM(discover_views) AS show_cnt,
        SUM(ios_discover_views) AS ios_show_cnt,
        SUM(android_discover_views) AS android_show_cnt,
        SUM(discover_ad_views) AS ad_cnt,
        SUM(ios_discover_ad_views) AS ios_ad_cnt,
        SUM(android_discover_ad_views) AS android_ad_cnt
      FROM dws_taptap_app_keywords_ad_daily
      WHERE crawled_at > '${dateStr}'
        AND keyword IS NOT NULL AND keyword != ''
      GROUP BY keyword

      UNION ALL

      SELECT
        'hot_search' AS source,
        keyword,
        SUM(hot_search_views) AS show_cnt,
        SUM(ios_hot_search_views) AS ios_show_cnt,
        SUM(android_hot_search_views) AS android_show_cnt,
        SUM(hot_search_ad_views) AS ad_cnt,
        SUM(ios_hot_search_ad_views) AS ios_ad_cnt,
        SUM(android_hot_search_ad_views) AS android_ad_cnt
      FROM dws_taptap_app_keywords_ad_daily
      WHERE crawled_at > '${dateStr}'
        AND keyword IS NOT NULL AND keyword != ''
      GROUP BY keyword

      UNION ALL

      SELECT
        'hot_spot' AS source,
        keyword,
        SUM(hot_spot_views) AS show_cnt,
        SUM(ios_hot_spot_views) AS ios_show_cnt,
        SUM(android_hot_spot_views) AS android_show_cnt,
        SUM(hot_spot_ad_views) AS ad_cnt,
        SUM(ios_hot_spot_ad_views) AS ios_ad_cnt,
        SUM(android_hot_spot_ad_views) AS android_ad_cnt
      FROM dws_taptap_app_keywords_ad_daily
      WHERE crawled_at > '${dateStr}'
        AND keyword IS NOT NULL AND keyword != ''
      GROUP BY keyword
    ) t
    ORDER BY source, ad_cnt DESC
  `;
}

/** 构建TapApp搜索页关键词每日投放趋势 SQL（最近7天，dws日汇总表按source+keyword+日聚合广告投放次数） */
export function buildTapAppSearchKeywordDailyTrendSql() {
  const dateStr = recentDaysWhere(7);
  return `
    SELECT
      source,
      keyword,
      day,
      ad_cnt
    FROM (
      SELECT
        'discovery' AS source,
        keyword,
        crawled_at AS day,
        SUM(discover_ad_views) AS ad_cnt
      FROM dws_taptap_app_keywords_ad_daily
      WHERE crawled_at > '${dateStr}'
        AND keyword IS NOT NULL AND keyword != ''
      GROUP BY keyword, crawled_at

      UNION ALL

      SELECT
        'hot_search' AS source,
        keyword,
        crawled_at AS day,
        SUM(hot_search_ad_views) AS ad_cnt
      FROM dws_taptap_app_keywords_ad_daily
      WHERE crawled_at > '${dateStr}'
        AND keyword IS NOT NULL AND keyword != ''
      GROUP BY keyword, crawled_at

      UNION ALL

      SELECT
        'hot_spot' AS source,
        keyword,
        crawled_at AS day,
        SUM(hot_spot_ad_views) AS ad_cnt
      FROM dws_taptap_app_keywords_ad_daily
      WHERE crawled_at > '${dateStr}'
        AND keyword IS NOT NULL AND keyword != ''
      GROUP BY keyword, crawled_at
    ) t
    ORDER BY source, keyword, day
  `;
}

/** 构建TapApp搜索页总曝光/总投放 SQL（最近30天，overview总览表按source直接SUM，供KPI卡片） */
export function buildTapAppSearchTotalStatsSql() {
  const dateStr = recentDaysWhere(30);
  return `
    SELECT
      source,
      total_show_cnt,
      total_ad_cnt
    FROM (
      SELECT
        'discovery' AS source,
        SUM(discover_views) AS total_show_cnt,
        SUM(discover_ad_views) AS total_ad_cnt
      FROM dws_taptap_app_keywords_ad_overview
      WHERE crawled_at > '${dateStr}'

      UNION ALL

      SELECT
        'hot_search' AS source,
        SUM(hot_search_views) AS total_show_cnt,
        SUM(hot_search_ad_views) AS total_ad_cnt
      FROM dws_taptap_app_keywords_ad_overview
      WHERE crawled_at > '${dateStr}'

      UNION ALL

      SELECT
        'hot_spot' AS source,
        SUM(hot_spot_views) AS total_show_cnt,
        SUM(hot_spot_ad_views) AS total_ad_cnt
      FROM dws_taptap_app_keywords_ad_overview
      WHERE crawled_at > '${dateStr}'
    ) t
  `;
}

/** 构建TapApp搜索页关键词概述 SQL（最近7天，overview总览表每来源直接SUM，供表格总计行） */
export function buildTapAppSearchKeywordOverviewSql() {
  const dateStr = recentDaysWhere(7);
  return `
    SELECT
      source,
      show_cnt,
      ios_show_cnt,
      android_show_cnt,
      ad_cnt,
      ios_ad_cnt,
      android_ad_cnt
    FROM (
      SELECT
        'discovery' AS source,
        SUM(discover_views) AS show_cnt,
        SUM(ios_discover_views) AS ios_show_cnt,
        SUM(android_discover_views) AS android_show_cnt,
        SUM(discover_ad_views) AS ad_cnt,
        SUM(ios_discover_ad_views) AS ios_ad_cnt,
        SUM(android_discover_ad_views) AS android_ad_cnt
      FROM dws_taptap_app_keywords_ad_overview
      WHERE crawled_at > '${dateStr}'

      UNION ALL

      SELECT
        'hot_search' AS source,
        SUM(hot_search_views) AS show_cnt,
        SUM(ios_hot_search_views) AS ios_show_cnt,
        SUM(android_hot_search_views) AS android_show_cnt,
        SUM(hot_search_ad_views) AS ad_cnt,
        SUM(ios_hot_search_ad_views) AS ios_ad_cnt,
        SUM(android_hot_search_ad_views) AS android_ad_cnt
      FROM dws_taptap_app_keywords_ad_overview
      WHERE crawled_at > '${dateStr}'

      UNION ALL

      SELECT
        'hot_spot' AS source,
        SUM(hot_spot_views) AS show_cnt,
        SUM(ios_hot_spot_views) AS ios_show_cnt,
        SUM(android_hot_spot_views) AS android_show_cnt,
        SUM(hot_spot_ad_views) AS ad_cnt,
        SUM(ios_hot_spot_ad_views) AS ios_ad_cnt,
        SUM(android_hot_spot_ad_views) AS android_ad_cnt
      FROM dws_taptap_app_keywords_ad_overview
      WHERE crawled_at > '${dateStr}'
    ) t
  `;
}

/** 构建TapApp搜索页关键词概述每日投放趋势 SQL（最近7天，overview总览表每来源按日直接取值） */
export function buildTapAppSearchKeywordOverviewDailyTrendSql() {
  const dateStr = recentDaysWhere(7);
  return `
    SELECT
      source,
      day,
      ad_cnt
    FROM (
      SELECT
        'discovery' AS source,
        crawled_at AS day,
        discover_ad_views AS ad_cnt
      FROM dws_taptap_app_keywords_ad_overview
      WHERE crawled_at > '${dateStr}'

      UNION ALL

      SELECT
        'hot_search' AS source,
        crawled_at AS day,
        hot_search_ad_views AS ad_cnt
      FROM dws_taptap_app_keywords_ad_overview
      WHERE crawled_at > '${dateStr}'

      UNION ALL

      SELECT
        'hot_spot' AS source,
        crawled_at AS day,
        hot_spot_ad_views AS ad_cnt
      FROM dws_taptap_app_keywords_ad_overview
      WHERE crawled_at > '${dateStr}'
    ) t
    ORDER BY source, day
  `;
}

/** 构建TapApp搜索页关键词投放排名 SQL（本日/本周/本月，命中当前周期的排名） */
export function buildTapAppSearchKeywordRankSql() {
  return `
    SELECT
      kv_source,
      keyword,
      rank_type,
      ad_views_rank
    FROM dws_taptap_app_keywords_ad_rank
    WHERE (rank_type = 'daily' AND crawled_at = strftime('%Y-%m-%d', 'now', 'localtime'))
       OR (rank_type = 'weekly' AND crawled_at = strftime('%Y-%W', 'now', 'localtime'))
       OR (rank_type = 'monthly' AND crawled_at = strftime('%Y-%m', 'now', 'localtime'))
  `;
}

