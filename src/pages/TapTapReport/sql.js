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

/** 快照小时键的宽限分钟：当前小时前 N 分钟抓取数据还没入库，此时回退到上一小时 */
export const SNAPSHOT_GRACE_MINUTES = 15;

/** 「本时段」是否已过宽限分钟（false 表示展示的是上一小时） */
export function isCurrentHourReady(graceMinutes = SNAPSHOT_GRACE_MINUTES) {
  return new Date().getMinutes() >= graceMinutes;
}

/**
 * 快照小时键（与抓取表 crawled_at 的 'YYYY-MM-DD HH' 格式一致）
 * 当前小时不满 graceMinutes 分钟时（如 11:07）回退到上一小时（10），避免查到空数据。
 */
export function currentHourKey(graceMinutes = SNAPSHOT_GRACE_MINUTES) {
  const now = new Date();
  const at = new Date(now);
  if (now.getMinutes() < graceMinutes) at.setHours(at.getHours() - 1); // 0 点会自然退到前一天 23 点
  const m = String(at.getMonth() + 1).padStart(2, '0');
  const d = String(at.getDate()).padStart(2, '0');
  const h = String(at.getHours()).padStart(2, '0');
  return `${at.getFullYear()}-${m}-${d} ${h}`;
}

/**
 * 构建「本时段抓取到的广告」快照 SQL：[广告大盘] 本周游戏明细卡片用
 * 取当前小时（crawled_at = 'YYYY-MM-DD HH'）三个渠道去重后的游戏（app_id + 名称 + 图标）：
 *   home    APP首页广告：taptap_app_{ios,android}_landing_ad_hourly，仅 is_ad='True' 或 pcebid='pcebid'
 * 行带 platform（ios / android；PC 为空），供前端在行尾标平台图标。
 *   keyword 关键词广告：taptap_app_{ios,android}_search_{discovery,hot_search,hot_spot}_ad_hourly，仅 is_ad='ad'
 *   pc      PC广告：taptap_pc_ad_top_hourly + taptap_pc_ad_discovery_hourly，仅 is_ad='True'
 * 名称/图标统一走 dim（各抓取表 + dws_taptap_game + 广告聚合表），弥补关键词表只有 app_id 没有名称。
 */
export function buildCurrentHourAdSnapshotSql(hour = currentHourKey()) {
  const h = hour;
  const at = `crawled_at = '${h}'`;
  const homeWhere = `${at} AND (is_ad = 'True' OR pcebid = 'pcebid')`;
  const pcWhere = `${at} AND is_ad = 'True'`;
  return `
    WITH dim AS (
      SELECT app_id, MAX(app_name) AS app_name, MAX(icon) AS icon
      FROM (
        SELECT app_id, app_name, icon FROM taptap_app_ios_landing_ad_hourly
        UNION ALL SELECT app_id, app_name, icon FROM taptap_app_android_landing_ad_hourly
        UNION ALL SELECT app_id, app_name, icon FROM taptap_pc_ad_top_hourly
        UNION ALL SELECT app_id, app_name, icon FROM taptap_pc_ad_discovery_hourly
        UNION ALL SELECT app_id, app_name, icon FROM dws_taptap_game
        UNION ALL SELECT app_id, app_name, icon FROM dws_taptap_ad_aggr_v5_daily
      )
      WHERE app_id IS NOT NULL AND app_id > 0
      GROUP BY app_id
    ),
    src AS (
      SELECT 'home' AS grp, 'ios' AS platform, app_id FROM taptap_app_ios_landing_ad_hourly WHERE ${homeWhere}
      UNION SELECT 'home', 'android', app_id FROM taptap_app_android_landing_ad_hourly WHERE ${homeWhere}
      UNION SELECT 'keyword', 'ios', app_id FROM taptap_app_ios_search_discovery_ad_hourly WHERE ${at} AND is_ad = 'ad'
      UNION SELECT 'keyword', 'ios', app_id FROM taptap_app_ios_search_hot_search_ad_hourly WHERE ${at} AND is_ad = 'ad'
      UNION SELECT 'keyword', 'ios', app_id FROM taptap_app_ios_search_hot_spot_ad_hourly WHERE ${at} AND is_ad = 'ad'
      UNION SELECT 'keyword', 'android', app_id FROM taptap_app_android_search_discovery_ad_hourly WHERE ${at} AND is_ad = 'ad'
      UNION SELECT 'keyword', 'android', app_id FROM taptap_app_android_search_hot_search_ad_hourly WHERE ${at} AND is_ad = 'ad'
      UNION SELECT 'keyword', 'android', app_id FROM taptap_app_android_search_hot_spot_ad_hourly WHERE ${at} AND is_ad = 'ad'
      UNION SELECT 'pc', '', app_id FROM taptap_pc_ad_top_hourly WHERE ${pcWhere}
      UNION SELECT 'pc', '', app_id FROM taptap_pc_ad_discovery_hourly WHERE ${pcWhere}
    )
    SELECT s.grp, s.platform, s.app_id, d.app_name, d.icon
    FROM src s LEFT JOIN dim d ON d.app_id = s.app_id
    WHERE s.app_id IS NOT NULL
    ORDER BY s.grp, s.platform, d.app_name
  `;
}

/**
 * 广告游戏 dim CTE：按 app_id 汇总名称、图标与三级标签，供明细 SQL 补齐（很多抓取表 icon / app_name 为 NULL）
 * @param {string[]} extraTables 额外参与补全的表（需要有 app_id / app_name / icon 三列）
 */
function adGameDimCte(extraTables = []) {
  // 表可用字符串（默认有 tag_1~3），或用 { table, tags: false } 声明没有标签列的表
  const normalize = (t) => (typeof t === 'string' ? { table: t, tags: true } : { tags: true, ...t });
  const tables = [
    'taptap_app_ios_landing_ad_hourly',
    'taptap_app_android_landing_ad_hourly',
    'taptap_pc_ad_top_hourly',
    'taptap_pc_ad_discovery_hourly',
    'dws_taptap_game',
    'dws_taptap_ad_aggr_v5_daily',
    ...extraTables,
  ].map(normalize);
  const union = tables
    .map((t, i) => {
      const cols = t.tags ? 'tag_1, tag_2, tag_3' : 'NULL AS tag_1, NULL AS tag_2, NULL AS tag_3';
      return `${i === 0 ? 'SELECT' : 'UNION ALL SELECT'} app_id, app_name, icon, ${cols} FROM ${t.table}`;
    })
    .join(`
        `);
  return `
    WITH dim AS (
      SELECT app_id, MAX(app_name) AS app_name, MAX(icon) AS icon,
             MAX(tag_1) AS tag_1, MAX(tag_2) AS tag_2, MAX(tag_3) AS tag_3
      FROM (
        ${union}
      )
      WHERE app_id IS NOT NULL AND app_id > 0
      GROUP BY app_id
    )`;
}

/**
 * 构建 TapApp 首页广告本周明细 SQL（dws_taptap_ad_landing_app_v4_daily，本周一起逐日）
 * 只取 pcebid_views + ad_views > 0 的日行；输出按 (app_id, 日期) 聚合的
 * Android 广告 / iOS 广告 / 资源互换(pcebid) 三段投放次数，供堆叠条与趋势使用。
 */
export function buildTapAppLandingAdWeeklyDetailSql() {
  const monday = thisWeekWhere(0);
  return `
${adGameDimCte()}
    SELECT
      d.app_id,
      MAX(di.app_name) AS app_name, MAX(di.icon) AS icon,
      MAX(di.tag_1) AS tag_1, MAX(di.tag_2) AS tag_2, MAX(di.tag_3) AS tag_3,
      substr(d.crawled_at, 1, 10) AS day,
      SUM(COALESCE(d.android_ad_views, 0)) AS android_ad_views,
      SUM(COALESCE(d.ios_ad_views, 0)) AS ios_ad_views,
      SUM(COALESCE(d.pcebid_views, 0)) AS pcebid_views
    FROM dws_taptap_ad_landing_app_v4_daily d
    LEFT JOIN dim di ON di.app_id = d.app_id
    WHERE d.crawled_at >= '${monday}'
      AND (COALESCE(d.pcebid_views, 0) + COALESCE(d.ad_views, 0)) > 0
    GROUP BY d.app_id, substr(d.crawled_at, 1, 10)
    ORDER BY d.app_id, day
  `;
}

/**
 * 构建 TapApp 搜索关键词广告本周明细 SQL（dws_taptap_ad_keywords_app_v4_daily，本周一起逐日）
 * 三个渠道各自聚合 Android/iOS 广告投放次数（搜索发现 / 热搜 / 热点），
 * 只取三个渠道 ad_views 合计 > 0 的日行；名称/图标/标签优先取本表，缺失时由 dim 补齐。
 */
export function buildTapAppKeywordAdWeeklyDetailSql() {
  const monday = thisWeekWhere(0);
  return `
${adGameDimCte()}
    SELECT
      d.app_id,
      MAX(di.app_name) AS app_name, MAX(di.icon) AS icon,
      MAX(di.tag_1) AS tag_1, MAX(di.tag_2) AS tag_2, MAX(di.tag_3) AS tag_3,
      substr(d.crawled_at, 1, 10) AS day,
      SUM(COALESCE(d.android_discover_ad_views, 0)) AS discover_android,
      SUM(COALESCE(d.ios_discover_ad_views, 0)) AS discover_ios,
      SUM(COALESCE(d.android_hot_search_ad_views, 0)) AS hot_search_android,
      SUM(COALESCE(d.ios_hot_search_ad_views, 0)) AS hot_search_ios,
      SUM(COALESCE(d.android_hot_spot_ad_views, 0)) AS hot_spot_android,
      SUM(COALESCE(d.ios_hot_spot_ad_views, 0)) AS hot_spot_ios
    FROM dws_taptap_ad_keywords_app_v4_daily d
    LEFT JOIN dim di ON di.app_id = d.app_id
    WHERE d.crawled_at >= '${monday}'
      AND d.app_id > 0
      AND (COALESCE(d.discover_ad_views, 0) + COALESCE(d.hot_search_ad_views, 0) + COALESCE(d.hot_spot_ad_views, 0)) > 0
    GROUP BY d.app_id, substr(d.crawled_at, 1, 10)
    ORDER BY d.app_id, day
  `;
}

/**
 * 构建 TapPC 广告本周明细 SQL（dws_taptap_ad_landing_pc_v4_daily，本周一起逐日）
 * 只取 top_ad_views / discovery_ad_views 至少有一个 > 0 的日行（纯曝光不计入广告明细）；
 * 输出按 (app_id, 日期) 聚合的橱窗(Top)广告投放次数与发现位(每日新发现)广告投放次数，
 * 名称/图标优先取本表，缺失时由 dim（各抓取表 + dws_taptap_game + 广告聚合表）按 app_id 补齐
 * （本表 icon 基本全为 NULL）。
 */
export function buildPcAdWeeklyDetailSql() {
  const monday = thisWeekWhere(0);
  return `
${adGameDimCte()}
    SELECT
      d.app_id,
      MAX(di.app_name) AS app_name, MAX(di.icon) AS icon,
      MAX(di.tag_1) AS tag_1, MAX(di.tag_2) AS tag_2, MAX(di.tag_3) AS tag_3,
      substr(d.crawled_at, 1, 10) AS day,
      SUM(COALESCE(d.top_ad_views, 0)) AS top_ad_views,
      SUM(COALESCE(d.discovery_ad_views, 0)) AS discovery_ad_views
    FROM dws_taptap_ad_landing_pc_v4_daily d
    LEFT JOIN dim di ON di.app_id = d.app_id
    WHERE d.crawled_at >= '${monday}'
      AND (COALESCE(d.top_ad_views, 0) > 0 OR COALESCE(d.discovery_ad_views, 0) > 0)
    GROUP BY d.app_id, substr(d.crawled_at, 1, 10)
    ORDER BY d.app_id, day
  `;
}

/** 本周第一天（周一，YYYY-MM-DD）；weeksBack=1 时为上周一 */
export function thisWeekWhere(weeksBack = 0) {
  const now = new Date();
  const diff = (now.getDay() + 6) % 7; // 距周一的天数（周日=0 → 6）
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff - weeksBack * 7);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

/** 构建游戏信息映射 SQL（当前月份）：名称 + icon + 三个标签 */
export function buildGameNameSql() {
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `
    SELECT app_id, app_name, icon, tag_1, tag_2, tag_3
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
      SELECT * FROM taptap_online_peak_players_ids_weekly
      WHERE crawled_at = date('now', 'localtime', '-' || ((strftime('%w', 'now', 'localtime') + 6) % 7) || ' days')
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

/** 构建TapPC峰值在线 KPI SQL（各指标的最大值及其发生的时间节点） */
export function buildPcOnlinePeakKpisSql() {
  const table = 'dws_taptap_pc_online_peak_players_hourly';
  const one = (key, col) => `SELECT * FROM (SELECT '${key}' AS k, ${col} AS v, crawled_at AS at FROM ${table} ORDER BY ${col} DESC, crawled_at DESC LIMIT 1)`;
  return [
    one('online', 'online_players'),
    one('pc', 'pc_online_players'),
    one('pc_emulator', 'pc_emulator_online_players'),
    one('creative', 'creative_online_players'),
    one('creative_non', 'creative_non_online_players'),
    one('creative_mk', 'creative_mk_online_players'),
  ].join('\n    UNION ALL\n    ');
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

/** 构建 TapTap 广告大盘日趋势 SQL（上周一至今，按日汇总各口径广告数）
 *  表：dws_taptap_ad_aggr_v5_daily（按 app_id + 日的广告投放汇总，无曝光列）
 *  口径：广告数 = ad_views + pcebid_views；APP / PC / KW 同口径（*_ad_views + *_pcebid_views）
 */
export function buildAdAggrDailyTrendSql() {
  const dateStr = thisWeekWhere(1);
  const adExpr = (ad, pcebid) => `SUM(COALESCE(${ad}, 0)) + SUM(COALESCE(${pcebid}, 0))`;
  return `
    SELECT
      substr(crawled_at, 1, 10) AS day,
      ${adExpr('ad_views', 'pcebid_views')} AS ad_views,
      ${adExpr('app_ad_views', 'app_pcebid_views')} AS app_ad_views,
      ${adExpr('pc_ad_views', 'pc_pcebid_views')} AS pc_ad_views,
      ${adExpr('kw_ad_views', 'kw_pcebid_views')} AS kw_ad_views
    FROM dws_taptap_ad_aggr_v5_daily
    WHERE crawled_at >= '${dateStr}'
    GROUP BY substr(crawled_at, 1, 10)
    ORDER BY day
  `;
}

/** 构建 TapTap 广告大盘周汇总 SQL（上周一 ~ 本周末，按 本周/上周 分组）
 *  用于「广告占比」堆叠柱：口径同趋势图，广告数 = *_ad_views + *_pcebid_views
 */
export function buildAdShareByWeekSql() {
  const lastMonday = thisWeekWhere(1);
  const thisMonday = thisWeekWhere(0);
  const nextMonday = thisWeekWhere(-1);
  const adExpr = (ad, pcebid) => `SUM(COALESCE(${ad}, 0)) + SUM(COALESCE(${pcebid}, 0))`;
  return `
    SELECT
      CASE WHEN substr(crawled_at, 1, 10) >= '${thisMonday}' THEN 'this' ELSE 'last' END AS week_key,
      ${adExpr('app_ad_views', 'app_pcebid_views')} AS app_ad_views,
      ${adExpr('pc_ad_views', 'pc_pcebid_views')} AS pc_ad_views,
      ${adExpr('kw_ad_views', 'kw_pcebid_views')} AS kw_ad_views
    FROM dws_taptap_ad_aggr_v5_daily
    WHERE crawled_at >= '${lastMonday}' AND crawled_at < '${nextMonday}'
    GROUP BY week_key
  `;
}

/** 构建 TapTap 广告本周游戏 TopN SQL（本周一 ~ 下周一，按 app 聚合，按总投放→总曝光倒序）
 *  口径：商业AD=ad_views、资源互换AD=pcebid_views、总投放=ad_views+pcebid_views
 */
export function buildAdGameWeeklyTopSql(limit = 20) {
  const thisMonday = thisWeekWhere(0);
  const nextMonday = thisWeekWhere(-1);
  return `
    SELECT
      app_id, app_name, tag_1, tag_2, tag_3,
      MAX(icon) AS icon,
      MAX(distribution_type) AS distribution_type,
      SUM(ad_views) AS ad_views,
      SUM(app_ad_views) AS app_ad_views,
      SUM(pc_ad_views) AS pc_ad_views,
      SUM(kw_ad_views) AS kw_ad_views,
      SUM(pcebid_views) AS pcebid_views,
      SUM(app_pcebid_views) AS app_pcebid_views,
      SUM(pc_pcebid_views) AS pc_pcebid_views,
      SUM(kw_pcebid_views) AS kw_pcebid_views
    FROM dws_taptap_ad_aggr_v5_daily
    WHERE crawled_at >= '${thisMonday}' AND crawled_at < '${nextMonday}'
    GROUP BY app_id, app_name, tag_1, tag_2, tag_3
    ORDER BY SUM(ad_views) + SUM(pcebid_views) DESC
    LIMIT ${limit}
  `;
}

/**
 * 构建「本周各渠道广告数」按 app + 日 的趋势 SQL（本周一 ~ 下周一）
 * 供【广告大盘】本周游戏明细「详细趋势」弹框：分 APP首页 / PC首页 / APP搜索关键词三个渠道
 *   APP首页广告 = app_ad_views + app_pcebid_views
 *   PC首页广告  = pc_ad_views + pc_pcebid_views
 *   APP搜索关键词广告 = kw_ad_views + kw_pcebid_views
 */
export function buildAdGameChannelTrendSql() {
  const thisMonday = thisWeekWhere(0);
  const nextMonday = thisWeekWhere(-1);
  const expr = (ad, pcebid) => `SUM(COALESCE(${ad}, 0)) + SUM(COALESCE(${pcebid}, 0))`;
  return `
    SELECT
      app_id,
      substr(crawled_at, 1, 10) AS day,
      ${expr('app_ad_views', 'app_pcebid_views')} AS app_home,
      ${expr('pc_ad_views', 'pc_pcebid_views')} AS pc_home,
      ${expr('kw_ad_views', 'kw_pcebid_views')} AS kw_search
    FROM dws_taptap_ad_aggr_v5_daily
    WHERE crawled_at >= '${thisMonday}' AND crawled_at < '${nextMonday}'
    GROUP BY app_id, substr(crawled_at, 1, 10)
    ORDER BY app_id, day
  `;
}

/** 构建 TapTap 广告按游戏的每日总投放趋势 SQL（上周一至今，供 Top20 表格的趋势 sparkline 用）
 *  push_cnt = 商业AD(ad_views) + 资源互换AD(pcebid_views)
 *  注：与 TapPC 的 buildAdGameDailyTrendSql 区分命名
 */
export function buildAdAggrGameDailyTrendSql() {
  const dateStr = thisWeekWhere(1);
  return `
    SELECT
      app_id,
      substr(crawled_at, 1, 10) AS day,
      SUM(COALESCE(ad_views, 0)) + SUM(COALESCE(pcebid_views, 0)) AS push_cnt
    FROM dws_taptap_ad_aggr_v5_daily
    WHERE crawled_at >= '${dateStr}'
    GROUP BY app_id, substr(crawled_at, 1, 10)
    ORDER BY app_id, day
  `;
}

/** 构建 TapTap 广告全站周汇总 SQL（本周一 ~ 下周一，overview 表；供 Top20 表格的汇总行与贡献度分母） */
export function buildAdOverviewWeekSql() {
  const thisMonday = thisWeekWhere(0);
  const nextMonday = thisWeekWhere(-1);
  return `
    SELECT
      SUM(ad_views) AS ad_views,
      SUM(app_ad_views) AS app_ad_views,
      SUM(pc_ad_views) AS pc_ad_views,
      SUM(kw_ad_views) AS kw_ad_views,
      SUM(pcebid_views) AS pcebid_views,
      SUM(app_pcebid_views) AS app_pcebid_views,
      SUM(pc_pcebid_views) AS pc_pcebid_views,
      SUM(kw_pcebid_views) AS kw_pcebid_views,
      SUM(COALESCE(ad_views, 0)) + SUM(COALESCE(pcebid_views, 0)) AS total_push
    FROM dws_taptap_ad_overview_v5_daily
    WHERE crawled_at >= '${thisMonday}' AND crawled_at < '${nextMonday}'
  `;
}

/** 构建 TapTap 广告全站每日总投放趋势 SQL（上周一至今，用于汇总行的趋势 sparkline） */
export function buildAdOverviewDailyTrendSql() {
  const dateStr = thisWeekWhere(1);
  return `
    SELECT
      substr(crawled_at, 1, 10) AS day,
      SUM(COALESCE(ad_views, 0)) + SUM(COALESCE(pcebid_views, 0)) AS push_cnt
    FROM dws_taptap_ad_overview_v5_daily
    WHERE crawled_at >= '${dateStr}'
    GROUP BY substr(crawled_at, 1, 10)
    ORDER BY day
  `;
}

/**
 * 周键（YYYY-WW）：与爬虫口径一致 —— 周一为一周起点，按「当年第几周」计数（同 strftime('%W')）。
 * 注意：这不是 ISO 周（ISO 里 2026-10-19 是第 43 周，爬虫标签是 2026-42）。
 */
function weekOfYearLabel(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const yday = Math.round((d - jan1) / 86400000); // 0-based 年内第几天
  const weekday = (d.getDay() + 6) % 7; // 周一=0
  const week = Math.floor((yday + 7 - weekday) / 7);
  return `${d.getFullYear()}-${String(week).padStart(2, '0')}`;
}

/** 上周（上一自然周）的周键，用于查 dws_taptap_ad_rank_v4_daily 的 weekly 快照 */
export function lastWeekRankKey() {
  return weekOfYearLabel(new Date(`${thisWeekWhere(1)}T00:00:00`));
}

/** 构建 TapTap 广告上周投放排名 SQL（rank_type=weekly，取上一自然周的官方快照） */
export function buildAdRankWeekSql() {
  const weekKey = lastWeekRankKey();
  return `
    SELECT app_id, ad_rank
    FROM dws_taptap_ad_rank_v4_daily
    WHERE rank_type = 'weekly' AND crawled_at = '${weekKey}'
  `;
}

/** 构建 TapTap 广告上周投放排名「推算」SQL：官方快照未入库时，按上周总投放倒序现算（口径与官方一致） */
export function buildAdRankDerivedWeekSql(limit = 20) {
  const lastMonday = thisWeekWhere(1);
  const thisMonday = thisWeekWhere(0);
  const push = 'SUM(COALESCE(ad_views, 0)) + SUM(COALESCE(pcebid_views, 0))';
  return `
    SELECT
      app_id,
      app_name,
      ${push} AS push_cnt,
      SUM(COALESCE(app_ad_views, 0)) + SUM(COALESCE(app_pcebid_views, 0)) AS app_ad_views,
      SUM(COALESCE(pc_ad_views, 0)) + SUM(COALESCE(pc_pcebid_views, 0)) AS pc_ad_views,
      SUM(COALESCE(kw_ad_views, 0)) + SUM(COALESCE(kw_pcebid_views, 0)) AS kv_ad_views
    FROM dws_taptap_ad_aggr_v5_daily
    WHERE crawled_at >= '${lastMonday}' AND crawled_at < '${thisMonday}'
    GROUP BY app_id, app_name
    ORDER BY ${push} DESC
    LIMIT ${limit}
  `;
}

/**
 * 构建 TapTap 广告投放 TopN 排名 SQL
 * @param {string} rankType daily / weekly / monthly
 * @param {number} limit 取前 N 名
 * @param {string|null} label 指定快照标签（如 '2026-41'、'2026-09'）；不传则取该类型最新快照
 */
export function buildAdRankTopSql(rankType = 'daily', limit = 10, label = null) {
  const snapshot = label
    ? `crawled_at = '${label}'`
    : `crawled_at = (SELECT MAX(crawled_at) FROM dws_taptap_ad_rank_v4_daily WHERE rank_type = '${rankType}')`;
  return `
    SELECT
      app_id, app_name, total_ad_veiws, ad_rank, crawled_at,
      total_app_ad_views, total_pc_ad_views, total_kv_ad_views
    FROM dws_taptap_ad_rank_v4_daily
    WHERE rank_type = '${rankType}' AND ${snapshot}
    ORDER BY ad_rank
    LIMIT ${limit}
  `;
}

/** 上个月份键（YYYY-MM），用于查 rank 表的 monthly 上月快照 */
export function lastMonthLabel() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
