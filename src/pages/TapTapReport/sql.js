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

/** 构建TapPC在线人数趋势 SQL（最近24小时） */
export function buildOnlinePlayersTrendSql() {
  const dateStr = recentHoursWhere(24);
  return `
    SELECT
      crawled_at,
      today_total_online_players,
      yesterday_total_online_players,
      ago_7_total_online_players,
      ago_30_total_online_players,
      ago_90_total_online_players,
      ago_365_total_online_players
    FROM dws_taptap_peak_players_hourly
    WHERE crawled_at >= '${dateStr}'
    ORDER BY crawled_at
  `;
}

/** 构建TapPC热玩游戏榜在线人数历史统计 SQL（峰值最高/最低/均值及统计区间） */
export function buildOnlinePlayersStatsSql() {
  return `
    SELECT
      MIN(crawled_at) AS start_crawled_at,
      MAX(crawled_at) AS end_crawled_at,
      MAX(online_players) AS max_online_players,
      AVG(online_players) AS avg_online_players,
      MIN(online_players) AS min_online_players
    FROM dws_tmp_taptap_peak_players_hourly
    WHERE crawled_at < substr(datetime('now', 'localtime', '-1 day'), 1, 13)
  `;
}

/** 构建TapPC在线人数分布 SQL（指定时间点，按人数区间分桶） */
export function buildOnlinePlayersDistributionSql(dateStr) {
  return `
    SELECT
      CASE
        WHEN online_players < 100 THEN '1-99'
        WHEN online_players = 100 THEN '=100'
        WHEN online_players > 100 AND online_players <= 500 THEN '100-500'
        WHEN online_players > 500 AND online_players <= 1000 THEN '500-1000'
        WHEN online_players > 1000 AND online_players <= 5000 THEN '1000-5000'
        WHEN online_players > 5000 AND online_players <= 10000 THEN '5000-10000'
        ELSE '10000+'
      END AS player_bucket,
      COUNT(*) AS cnt
    FROM taptap_pc_online_players
    WHERE crawled_at = '${dateStr}'
    GROUP BY player_bucket
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

/** 构建TapPC在线人数TopN趋势 SQL（最近24小时，Top20 app 的在线人数时序） */
export function buildOnlinePlayersTopNTrendSql() {
  const dateStr = recentHoursWhere(24);
  return `
    SELECT
      a.app_id,
      b.app_name,
      a.crawled_at,
      a.online_players
    FROM (
      SELECT *
      FROM taptap_pc_online_players
      WHERE crawled_at >= '${dateStr}'
        AND app_id IN (
          SELECT app_id
          FROM taptap_pc_online_players
          WHERE crawled_at >= '${dateStr}'
          GROUP BY app_id
          ORDER BY MAX(online_players) DESC
          LIMIT 20
        )
    ) a
    LEFT JOIN (
      SELECT *
      FROM taptap_pc_played_ids_daily
      WHERE crawled_at = strftime('%Y-%m-%d', 'now', 'localtime')
    ) b
      ON a.app_id = b.app_id
    ORDER BY a.app_id, a.crawled_at
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
      COUNT(*) AS show_cnt,
      SUM(CASE WHEN is_ad = 'True' THEN 1 ELSE 0 END) AS ad_cnt
    FROM taptap_ad_loading_hourly
    WHERE crawled_at > '${dateStr}'
      AND ad_type = 'tappc_2671'
    GROUP BY app_id
    ORDER BY ad_cnt DESC, show_cnt DESC
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

/** 构建TopN游戏占比 SQL（最新窗口，按排名分桶的累计在线人数） */
export function buildTopNProportionSql(dateStr) {
  return `
    SELECT
      bucket,
      cum_total_players AS online_players
    FROM (
      SELECT
        bucket,
        app_cnt,
        min_rk,
        SUM(app_cnt) OVER (ORDER BY min_rk) AS cum_app_cnt,
        SUM(total_players) OVER (ORDER BY min_rk) AS cum_total_players
      FROM (
        SELECT
          CASE
            WHEN rk <= 5 THEN 'Top5'
            WHEN rk <= 10 THEN 'Top10'
            WHEN rk <= 20 THEN 'Top20'
            WHEN rk <= 50 THEN 'Top50'
            WHEN rk <= 100 THEN 'Top100'
            ELSE 'Top100+'
          END AS bucket,
          MIN(rk) AS min_rk,
          COUNT(*) AS app_cnt,
          SUM(online_players) AS total_players
        FROM (
          SELECT
            app_id,
            online_players,
            RANK() OVER (ORDER BY online_players DESC) AS rk
          FROM taptap_pc_online_players
          WHERE crawled_at = '${dateStr}'
            AND online_players IS NOT NULL
        ) t
        GROUP BY bucket
      ) g
    ) x
    ORDER BY min_rk
  `;
}

/* ===== TapApp 首页找游戏广告（landing）===== */

/** 首页找游戏广告 iOS+Android UNION ALL 基础子查询（仅公共字段，is_ad 判定用 'True'，position<=20） */
function tapAppLandingBase(dateStr) {
  return `
    SELECT tag_1, tag_2, tag_3, app_name, app_id, position, is_ad, crawled_at, 'ios' AS platform
    FROM taptap_app_ios_landing_ad_hourly
    WHERE crawled_at > '${dateStr}' AND position <= 20
    UNION ALL
    SELECT tag_1, tag_2, tag_3, app_name, app_id, position, is_ad, crawled_at, 'android' AS platform
    FROM taptap_app_android_landing_ad_hourly
    WHERE crawled_at > '${dateStr}' AND position <= 20
  `;
}

/** 构建TapApp首页找游戏广告每日广告位统计 SQL（最近7天，按日+position 聚合广告加载率，只看前20个固定位置） */
export function buildTapAppAdNewPositionStatsSql() {
  const dateStr = recentDaysWhere(7);
  return `
    SELECT
      platform,
      crawled_at,
      position,
      show_cnt,
      ad_cnt,
      ROUND(ad_cnt * 1.0 / show_cnt, 2) AS ad_loading_rate
    FROM (
      SELECT
        platform,
        substr(crawled_at, 1, 10) AS crawled_at,
        position,
        COUNT(*) AS show_cnt,
        SUM(CASE WHEN is_ad = 'True' THEN 1 ELSE 0 END) AS ad_cnt
      FROM (${tapAppLandingBase(dateStr)}) b
      GROUP BY platform, substr(crawled_at, 1, 10), position
    ) t
  `;
}

/** 构建TapApp首页找游戏广告投放素材分布第一层 SQL（最近7天，合并tag_1/tag_2/tag_3为大类tag，聚合广告加载率） */
export function buildTapAppAdMaterialTagsSql() {
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
        FROM (${tapAppLandingBase(dateStr)}) b
        WHERE tag_1 IS NOT NULL
        GROUP BY tag_1
        UNION ALL
        SELECT
          tag_2 AS tag,
          COUNT(*) AS show_cnt,
          SUM(CASE WHEN is_ad = 'True' THEN 1 ELSE 0 END) AS ad_cnt
        FROM (${tapAppLandingBase(dateStr)}) b
        WHERE tag_2 IS NOT NULL
        GROUP BY tag_2
        UNION ALL
        SELECT
          tag_3 AS tag,
          COUNT(*) AS show_cnt,
          SUM(CASE WHEN is_ad = 'True' THEN 1 ELSE 0 END) AS ad_cnt
        FROM (${tapAppLandingBase(dateStr)}) b
        WHERE tag_3 IS NOT NULL
        GROUP BY tag_3
      ) u
      GROUP BY tag
    ) t
  `;
}

/** 构建TapApp首页找游戏广告投放素材分布第二层 SQL（最近7天，按合并后的tag+app_id聚合广告加载次数） */
export function buildTapAppAdMaterialGamesSql() {
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
      FROM (${tapAppLandingBase(dateStr)}) b
      WHERE is_ad = 'True' AND tag_1 IS NOT NULL
      GROUP BY tag_1, app_id, app_name
      UNION ALL
      SELECT
        tag_2 AS tag,
        app_id,
        app_name,
        COUNT(*) AS loaded_cnt
      FROM (${tapAppLandingBase(dateStr)}) b
      WHERE is_ad = 'True' AND tag_2 IS NOT NULL
      GROUP BY tag_2, app_id, app_name
      UNION ALL
      SELECT
        tag_3 AS tag,
        app_id,
        app_name,
        COUNT(*) AS loaded_cnt
      FROM (${tapAppLandingBase(dateStr)}) b
      WHERE is_ad = 'True' AND tag_3 IS NOT NULL
      GROUP BY tag_3, app_id, app_name
    ) u
    GROUP BY tag, app_id
  `;
}

/** 构建TapApp首页找游戏广告游戏列表 SQL（最近7天，按app_id聚合曝光/广告次数） */
export function buildTapAppAdGameListSql() {
  const dateStr = recentDaysWhere(7);
  return `
    SELECT
      app_id,
      MAX(app_name) AS app_name,
      MAX(tag_1) AS tag_1,
      MAX(tag_2) AS tag_2,
      MAX(tag_3) AS tag_3,
      COUNT(*) AS show_cnt,
      SUM(CASE WHEN platform = 'ios' THEN 1 ELSE 0 END) AS ios_show_cnt,
      SUM(CASE WHEN platform = 'android' THEN 1 ELSE 0 END) AS android_show_cnt,
      SUM(CASE WHEN is_ad = 'True' THEN 1 ELSE 0 END) AS ad_cnt,
      SUM(CASE WHEN platform = 'ios' AND is_ad = 'True' THEN 1 ELSE 0 END) AS ios_ad_cnt,
      SUM(CASE WHEN platform = 'android' AND is_ad = 'True' THEN 1 ELSE 0 END) AS android_ad_cnt
    FROM (${tapAppLandingBase(dateStr)}) b
    GROUP BY app_id
    ORDER BY ad_cnt DESC, show_cnt DESC
  `;
}

/** 构建TapApp首页找游戏广告每日投放趋势 SQL（最近7天，按app_id+日聚合广告投放次数） */
export function buildTapAppAdGameDailyTrendSql() {
  const dateStr = recentDaysWhere(7);
  return `
    SELECT
      app_id,
      substr(crawled_at, 1, 10) AS day,
      SUM(CASE WHEN is_ad = 'True' THEN 1 ELSE 0 END) AS ad_cnt
    FROM (${tapAppLandingBase(dateStr)}) b
    GROUP BY app_id, substr(crawled_at, 1, 10)
    ORDER BY app_id, day
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

/** 构建TapApp首页找游戏广告每日加载率趋势 SQL（最近7天，按日聚合曝光/广告次数与加载率） */
export function buildTapAppAdLoadingRateTrendSql() {
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
      FROM (${tapAppLandingBase(dateStr)}) b
      GROUP BY substr(crawled_at, 1, 10)
    ) t
  `;
}

/* ===== TapApp 搜索页广告（search）===== */

/** 搜索页广告 4 表 UNION ALL 基础子查询（is_ad 判定用 'ad'，加 source 列区分 discovery/hot_search） */
function tapAppSearchBase(dateStr) {
  return `
    SELECT keyword, app_id, position, is_ad, crawled_at, 'discovery' AS source
    FROM taptap_app_ios_search_discovery_ad_hourly
    WHERE crawled_at > '${dateStr}'
    UNION ALL
    SELECT keyword, app_id, position, is_ad, crawled_at, 'hot_search' AS source
    FROM taptap_app_ios_search_hot_search_ad_hourly
    WHERE crawled_at > '${dateStr}'
    UNION ALL
    SELECT keyword, app_id, position, is_ad, crawled_at, 'discovery' AS source
    FROM taptap_app_android_search_discovery_ad_hourly
    WHERE crawled_at > '${dateStr}'
    UNION ALL
    SELECT keyword, app_id, position, is_ad, crawled_at, 'hot_search' AS source
    FROM taptap_app_android_search_hot_search_ad_hourly
    WHERE crawled_at > '${dateStr}'
  `;
}

/** 构建TapApp搜索页广告位统计 SQL（最近7天，按日+position 聚合广告加载率） */
export function buildTapAppSearchPositionStatsSql() {
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
        SUM(CASE WHEN is_ad = 'ad' THEN 1 ELSE 0 END) AS ad_cnt
      FROM (${tapAppSearchBase(dateStr)}) b
      GROUP BY substr(crawled_at, 1, 10), position
    ) t
  `;
}

/** 构建TapApp搜索页广告每日加载率趋势 SQL（最近7天，按日聚合曝光/广告次数与加载率） */
export function buildTapAppSearchLoadingRateTrendSql() {
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
        SUM(CASE WHEN is_ad = 'ad' THEN 1 ELSE 0 END) AS ad_cnt
      FROM (${tapAppSearchBase(dateStr)}) b
      GROUP BY substr(crawled_at, 1, 10)
    ) t
  `;
}

/** 构建TapApp搜索页关键词广告统计 SQL（最近7天，按keyword聚合广告触发次数） */
export function buildTapAppSearchKeywordStatsSql() {
  const dateStr = recentDaysWhere(7);
  return `
    SELECT
      keyword,
      SUM(CASE WHEN is_ad = 'ad' THEN 1 ELSE 0 END) AS ad_cnt,
      COUNT(*) AS show_cnt
    FROM (${tapAppSearchBase(dateStr)}) b
    WHERE keyword IS NOT NULL AND keyword != ''
    GROUP BY keyword
    ORDER BY ad_cnt DESC
    LIMIT 20
  `;
}

/** 构建TapApp搜索页广告游戏列表 SQL（最近7天，仅 is_ad='ad' 行，按app_id聚合广告次数） */
export function buildTapAppSearchGameListSql() {
  const dateStr = recentDaysWhere(7);
  return `
    SELECT
      app_id,
      COUNT(*) AS ad_cnt
    FROM (${tapAppSearchBase(dateStr)}) b
    WHERE is_ad = 'ad' AND app_id IS NOT NULL
    GROUP BY app_id
    ORDER BY ad_cnt DESC
  `;
}
