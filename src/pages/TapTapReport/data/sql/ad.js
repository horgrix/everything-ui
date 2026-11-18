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

/**
 * 「今日广告曝光明细」（SQLite 的 dws_taptap_ad_aggr_v6_daily 当日行，不设 TopN 限制）
 * 一行一个 APP，按总投放（商业AD + 资源互换AD）倒序；与旧的本周 TopN 同字段，便于复用 transform。
 */
export function buildAdTodayDetailSql(ref = new Date()) {
  const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const today = fmt(ref);
  return `
    SELECT
      app_id, app_name, tag_1, tag_2, tag_3,
      MAX(icon) AS icon,
      MAX(distribution_type) AS distribution_type,
      SUM(COALESCE(ad_views, 0)) AS ad_views,
      SUM(COALESCE(app_ad_views, 0)) AS app_ad_views,
      SUM(COALESCE(pc_ad_views, 0)) AS pc_ad_views,
      SUM(COALESCE(kw_ad_views, 0)) AS kw_ad_views,
      SUM(COALESCE(pcebid_views, 0)) AS pcebid_views,
      SUM(COALESCE(app_pcebid_views, 0)) AS app_pcebid_views,
      SUM(COALESCE(pc_pcebid_views, 0)) AS pc_pcebid_views,
      SUM(COALESCE(kw_pcebid_views, 0)) AS kw_pcebid_views
    FROM dws_taptap_ad_aggr_v6_daily
    WHERE crawled_at = '${today}'
    GROUP BY app_id, app_name, tag_1, tag_2, tag_3
    HAVING SUM(COALESCE(ad_views, 0)) + SUM(COALESCE(pcebid_views, 0)) > 0
    ORDER BY SUM(COALESCE(ad_views, 0)) + SUM(COALESCE(pcebid_views, 0)) DESC, app_id
    LIMIT 500
  `;
}

/**
 * 「今日」三渠道逐小时广告命中数（SQLite 原始小时抓取表）
 * 口径与「本时段抓到的广告」一致：home = landing 表 is_ad='True' 或 pcebid='pcebid'；
 * kw = search 系列表 is_ad='ad'；pc = pc 两张表 is_ad='True'。
 * 每个 (app_id, 小时, 渠道) 一行，hits = 该小时命中的资源位条数。
 */
export function buildAdTodayHourlyTrendSql(ref = new Date()) {
  const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const since = `crawled_at >= '${fmt(ref)} 00'`;
  const homeWhere = `${since} AND (is_ad = 'True' OR pcebid = 'pcebid')`;
  const kwWhere = `${since} AND is_ad = 'ad'`;
  const pcWhere = `${since} AND is_ad = 'True'`;
  return `
    WITH src AS (
      SELECT 'app' AS ch, app_id, crawled_at FROM taptap_app_ios_landing_ad_hourly WHERE ${homeWhere}
      UNION ALL SELECT 'app', app_id, crawled_at FROM taptap_app_android_landing_ad_hourly WHERE ${homeWhere}
      UNION ALL SELECT 'kw', app_id, crawled_at FROM taptap_app_ios_search_discovery_ad_hourly WHERE ${kwWhere}
      UNION ALL SELECT 'kw', app_id, crawled_at FROM taptap_app_ios_search_hot_search_ad_hourly WHERE ${kwWhere}
      UNION ALL SELECT 'kw', app_id, crawled_at FROM taptap_app_ios_search_hot_spot_ad_hourly WHERE ${kwWhere}
      UNION ALL SELECT 'kw', app_id, crawled_at FROM taptap_app_android_search_discovery_ad_hourly WHERE ${kwWhere}
      UNION ALL SELECT 'kw', app_id, crawled_at FROM taptap_app_android_search_hot_search_ad_hourly WHERE ${kwWhere}
      UNION ALL SELECT 'kw', app_id, crawled_at FROM taptap_app_android_search_hot_spot_ad_hourly WHERE ${kwWhere}
      UNION ALL SELECT 'pc', app_id, crawled_at FROM taptap_pc_ad_top_hourly WHERE ${pcWhere}
      UNION ALL SELECT 'pc', app_id, crawled_at FROM taptap_pc_ad_discovery_hourly WHERE ${pcWhere}
    )
    SELECT app_id, substr(crawled_at, 12, 2) AS hh, ch, COUNT(*) AS hits
    FROM src
    WHERE app_id IS NOT NULL AND app_id > 0
    GROUP BY app_id, hh, ch
    ORDER BY app_id, hh
    LIMIT 5000
  `;
}

/**
 * 「今日行动量」：下载量 + 预约数（SQLite 小时表当日聚合），供 CPA 列做分母
 * kind = 'dl'（下载）/ 'rs'（预约）
 */
export function buildAppTodayActionSql(ref = new Date()) {
  const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const since = `crawled_at >= '${fmt(ref)} 00'`;
  return `
    SELECT 'dl' AS kind, app_id, SUM(COALESCE(download_count, 0)) AS v
    FROM dws_taptap_download_v2_hourly
    WHERE ${since}
    GROUP BY app_id
    UNION ALL
    SELECT 'rs', app_id, SUM(COALESCE(reserve_count, 0))
    FROM dws_taptap_reserve_v2_hourly
    WHERE ${since}
    GROUP BY app_id
  `;
}

/**
 * 各游戏的「发布时间」快照（SQLite taptap_game_info_hourly 最新一份），供 CPA 选分母：
 * 有发布时间（released_time > 0）= 已上线 → 用今日下载量；否则未上线 → 用今日预约数。
 */
export function buildAppReleasedSql() {
  return `
    SELECT app_id, MAX(COALESCE(released_time, 0)) AS released_time
    FROM taptap_game_info_hourly
    WHERE crawled_at = (SELECT MAX(crawled_at) FROM taptap_game_info_hourly)
    GROUP BY app_id
  `;
}
