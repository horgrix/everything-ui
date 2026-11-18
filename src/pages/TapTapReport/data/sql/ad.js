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

/** 构建 TapTap 广告本周游戏 TopN SQL（本周一 ~ 下周一，按 app 聚合，按总投放→总曝光倒序）
 *  口径：商业AD=ad_views、资源互换AD=pcebid_views、总投放=ad_views+pcebid_views
 */
export function buildAdGameWeeklyTopSql(limit = 50) {
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
 * 「今日」广告曝光汇总（SQLite 的 dws_taptap_ad_aggr_v6_daily 当日行，当日累计）
 * 渠道口径：APP首页 = app_ad_views + app_pcebid_views；APP搜索页 = kw_*；PC首页 = pc_*
 * PC 搜索页暂无数据源（未上线），由前端固定为 0。
 */
export function buildAdTodaySummarySql(ref = new Date()) {
  const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const today = fmt(ref);
  return `
    SELECT
      SUM(COALESCE(app_ad_views, 0) + COALESCE(app_pcebid_views, 0)) AS app_home,
      SUM(COALESCE(kw_ad_views, 0) + COALESCE(kw_pcebid_views, 0)) AS app_search,
      SUM(COALESCE(pc_ad_views, 0) + COALESCE(pc_pcebid_views, 0)) AS pc_home,
      COUNT(DISTINCT CASE
        WHEN COALESCE(ad_views, 0) + COALESCE(pcebid_views, 0) > 0 THEN app_id
      END) AS app_cnt
    FROM dws_taptap_ad_aggr_v6_daily
    WHERE crawled_at = '${today}'
  `;
}

/**
 * 「昨日 / 上周同日」广告曝光汇总（MySQL v09 的 dws_taptap_ad_aggr_v6_daily，历史数据）
 * @param {Date} [ref] 参照时间（默认今天）
 */
export function buildAdDaySummarySql(ref = new Date()) {
  const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const dayOffset = (n) => fmt(new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - n));
  const sum = (expr) => `SUM(${expr})`;
  return `
    SELECT
      crawled_at,
      ${sum('COALESCE(app_ad_views, 0) + COALESCE(app_pcebid_views, 0)')} AS app_home,
      ${sum('COALESCE(kw_ad_views, 0) + COALESCE(kw_pcebid_views, 0)')} AS app_search,
      ${sum('COALESCE(pc_ad_views, 0) + COALESCE(pc_pcebid_views, 0)')} AS pc_home,
      COUNT(DISTINCT CASE
        WHEN COALESCE(ad_views, 0) + COALESCE(pcebid_views, 0) > 0 THEN app_id
      END) AS app_cnt
    FROM dws_taptap_ad_aggr_v6_daily
    WHERE crawled_at IN ('${dayOffset(1)}', '${dayOffset(7)}')
    GROUP BY crawled_at
    ORDER BY crawled_at DESC
  `;
}
