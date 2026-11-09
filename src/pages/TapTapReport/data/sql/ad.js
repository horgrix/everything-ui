import { thisWeekWhere } from '../../dates';

/**
 * TapTap 广告相关 SQL（本时段快照 / 渠道本周明细 / 广告大盘）
 */

/**
 * 构建「本时段抓取到的广告」快照 SQL：[广告大盘] 本周游戏明细卡片用
 * 取当前小时（crawled_at = 'YYYY-MM-DD HH'）三个渠道去重后的游戏（app_id + 名称 + 图标）：
 *   home    APP首页广告：taptap_app_{ios,android}_landing_ad_hourly，仅 is_ad='True' 或 pcebid='pcebid'
 * 行带 platform（ios / android；PC 为空），供前端在行尾标平台图标。
 *   keyword 关键词广告：taptap_app_{ios,android}_search_{discovery,hot_search,hot_spot}_ad_hourly，仅 is_ad='ad'
 *   pc      PC广告：taptap_pc_ad_top_hourly + taptap_pc_ad_discovery_hourly，仅 is_ad='True'
 * 名称/图标统一走 dim（各抓取表 + taptap_game_info_hourly + 广告聚合表），弥补关键词表只有 app_id 没有名称。
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
        -- 本时段只看最新一小时：名称兜底表只取最新快照即可，避免加载整周无用数据
        UNION ALL SELECT app_id, app_name, icon FROM taptap_game_info_hourly
          WHERE crawled_at = (SELECT MAX(crawled_at) FROM taptap_game_info_hourly)
        UNION ALL SELECT app_id, app_name, icon FROM dws_taptap_ad_aggr_v6_daily
          WHERE crawled_at = (SELECT MAX(crawled_at) FROM dws_taptap_ad_aggr_v6_daily)
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
  // 表可用字符串（默认有 tag_1~3），或用 { table, tags: false, where } 声明没有标签列 / 需要附加过滤的表
  const normalize = (t) => (typeof t === 'string' ? { table: t, tags: true } : { tags: true, ...t });
  /**
   * 兜底字典表限定在本周窗口内，避免整表扫描（小时级表持续增长）。
   * 注意不能用「只取最新快照」：最新一次抓取只覆盖当期游戏，本周早些时候出现过的游戏会丢名称。
   */
  const sinceThisWeek = (table) => ({ table, where: `crawled_at >= '${thisWeekWhere(0)}'` });
  const tables = [
    'taptap_app_ios_landing_ad_hourly',
    'taptap_app_android_landing_ad_hourly',
    'taptap_pc_ad_top_hourly',
    'taptap_pc_ad_discovery_hourly',
    sinceThisWeek('taptap_game_info_hourly'),
    sinceThisWeek('dws_taptap_ad_aggr_v6_daily'),
    ...extraTables,
  ].map(normalize);
  const union = tables
    .map((t, i) => {
      const cols = t.tags ? 'tag_1, tag_2, tag_3' : 'NULL AS tag_1, NULL AS tag_2, NULL AS tag_3';
      const where = t.where ? ` WHERE ${t.where}` : '';
      return `${i === 0 ? 'SELECT' : 'UNION ALL SELECT'} app_id, app_name, icon, ${cols} FROM ${t.table}${where}`;
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
 * 名称/图标优先取本表，缺失时由 dim（各抓取表 + taptap_game_info_hourly + 广告聚合表）按 app_id 补齐
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
}/** 构建聚合下载 SQL（近24小时，按 crawled_at 汇总下载量，忽略0值） */

/** 构建 TapTap 广告大盘日趋势 SQL（上周一至今，按日汇总各口径广告数）
 *  表：dws_taptap_ad_aggr_v6_daily（按 app_id + 日的广告投放汇总，无曝光列）
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
    FROM dws_taptap_ad_aggr_v6_daily
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
    FROM dws_taptap_ad_aggr_v6_daily
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
    FROM dws_taptap_ad_aggr_v6_daily
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
    FROM dws_taptap_ad_aggr_v6_daily
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
    FROM dws_taptap_ad_aggr_v6_daily
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
    FROM dws_taptap_ad_aggr_v6_daily
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

/** 今天（YYYY-MM-DD） */
function todayWhere() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * 构建「每日投放广告的游戏数 + 每日广告总投放次数」SQL（上周一 ~ 今天，按日去重）
 * 投放口径：商业AD(ad_views) + 资源互换AD(pcebid_views) > 0
 */
export function buildAdGameCountDailySql() {
  const lastMonday = thisWeekWhere(1);
  const today = todayWhere();
  return `
    SELECT
      substr(crawled_at, 1, 10) AS day,
      COUNT(DISTINCT app_id) AS games,
      SUM(COALESCE(ad_views, 0) + COALESCE(pcebid_views, 0)) AS pushes
    FROM dws_taptap_ad_aggr_v6_daily
    WHERE crawled_at >= '${lastMonday}'
      AND crawled_at <= '${today}'
      AND (COALESCE(ad_views, 0) + COALESCE(pcebid_views, 0)) > 0
    GROUP BY substr(crawled_at, 1, 10)
    ORDER BY day
  `;
}
