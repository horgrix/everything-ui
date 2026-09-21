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
