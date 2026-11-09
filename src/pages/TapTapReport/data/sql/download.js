import { recentDaysWhere, recentHoursWhere, weekRange } from '../../dates';
import { HOURLY_TABLE, HOURLY_META_COLS } from './shared';

/**
 * 下载统计相关 SQL（小时表 v2 / 周趋势 v2_daily / 月趋势 v2_monthly）
 */

/** 近 24 小时增量（堆叠面积：商业 / 独立小游戏 / Maker小游戏），数据源 dws_taptap_download_summary_hourly */
export function buildAggregateSql() {
  const dateStr = recentHoursWhere(24);
  return `
    SELECT
      crawled_at,
      SUM(biz_download_count) as biz_download_count,
      SUM(mini_download_count) as mini_download_count,
      SUM(tmk_download_count) as tmk_download_count
    FROM dws_taptap_download_summary_hourly
    WHERE crawled_at >= '${dateStr}'
    GROUP BY crawled_at
    HAVING SUM(biz_download_count + mini_download_count + tmk_download_count) > 0
    ORDER BY crawled_at
  `;
}

/**
 * 构建周趋势 SQL（上周一 ~ 本周日，按天聚合平台 / 小游戏下载数）
 * 数据源为 MySQL 的 dws_taptap_download_v2_daily（走 v09 接口）：
 *   平台 = app/pc_download_count；小游戏按 distribution_type 1/2 汇总 download_count
 */
export function buildWeeklyTrendSql(ref = new Date()) {
  const { lastMonday, thisSunday } = weekRange(ref);
  return `
    SELECT
      crawled_at,
      SUM(app_download_count) AS app_download_count,
      SUM(pc_download_count) AS pc_download_count,
      SUM(CASE WHEN distribution_type = 1 THEN download_count ELSE 0 END) AS mini_download_count,
      SUM(CASE WHEN distribution_type = 2 THEN download_count ELSE 0 END) AS tmk_download_count
    FROM dws_taptap_download_v2_daily
    WHERE crawled_at >= '${lastMonday}' AND crawled_at <= '${thisSunday}'
    GROUP BY crawled_at
    ORDER BY crawled_at
  `;
}

/** 构建月趋势明细 SQL（最近12个月，MySQL v09 的 dws_taptap_download_v2_monthly） */
export function buildMonthlyBreakdownSql() {
  // MySQL（v09）的 dws_taptap_download_v2_monthly 已按月预聚合，直接取列即可
  const months = Math.max(1, 12);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
  return `
    SELECT
      crawled_at,
      app_download_count,
      pc_download_count,
      dist_type_1_download_count AS mini_download_count,
      dist_type_2_download_count AS tmk_download_count
    FROM dws_taptap_download_v2_monthly
    WHERE crawled_at >= '${startStr}'
    ORDER BY crawled_at
  `;
}

/** 构建追踪的游戏分布 SQL（小时窗口的统计时点；v2 小时表一行一个游戏） */
export function buildDistributionByWindowSql(windowStr) {
  return `
    SELECT
      crawled_at,
      COUNT(*) as trace_game_count,
      SUM(CASE WHEN pc_download_count > 0 THEN 1 ELSE 0 END) as pc_game_count,
      SUM(CASE WHEN app_download_count > 0 THEN 1 ELSE 0 END) as app_game_count,
      SUM(CASE WHEN distribution_type = 0 THEN 1 ELSE 0 END) as none_ai_game_count,
      SUM(CASE WHEN distribution_type IN (1, 2) THEN 1 ELSE 0 END) as ai_game_count,
      SUM(CASE WHEN distribution_type = 1 THEN 1 ELSE 0 END) as ai_none_maker_game_count,
      SUM(CASE WHEN distribution_type = 2 THEN 1 ELSE 0 END) as ai_maker_game_count
    FROM ${HOURLY_TABLE}
    WHERE crawled_at = '${windowStr}'
    GROUP BY crawled_at
    ORDER BY crawled_at
  `;
}

/**
 * 构建下载 TopN 明细 SQL（小时窗口的统计时点，数据源 v2 小时表：一行一个游戏）
 * opts: { limit, typeFilter, referFilter }
 * - referFilter: 'app' / 'pc' 只查该平台；'all' = APP+PC 全平台（按总下载数排序）
 * - typeFilter: distribution_type（1=独立小游戏、2=Maker小游戏）；'all' = 全部小游戏 IN (1,2)
 */
export function buildTop25DetailSql(windowStr, opts = {}) {
  const { limit = 25, typeFilter = null, referFilter = null } = opts;
  const referAll = referFilter === 'all';
  const referValue = referAll || referFilter == null ? null : String(referFilter);
  const typeAll = typeFilter === 'all';
  const typeValue = typeFilter == null || typeAll ? null : Number(typeFilter);
  const typeWhere = typeValue != null ? `distribution_type = ${typeValue}` : typeAll ? 'distribution_type IN (1, 2)' : null;

  // 平台列由 app/pc 下载数推断
  const referExpr = `CASE
          WHEN app_download_count > 0 AND pc_download_count > 0 THEN 'app+pc'
          WHEN pc_download_count > 0 THEN 'pc'
          WHEN app_download_count > 0 THEN 'app'
          ELSE '-'
        END`;

  // 指定平台：用该平台的下载数排序并作为「下载数」列
  if (referValue) {
    const referCol = referValue === 'pc' ? 'pc_download_count' : 'app_download_count';
    return `
      SELECT
        app_id,
        crawled_at,
        '${referValue}' as refer,
        distribution_type,
        total_download_count,
        ${referCol} as download_count,
        ${HOURLY_META_COLS}
      FROM ${HOURLY_TABLE}
      WHERE crawled_at = '${windowStr}'
        AND ${referCol} > 0
      ORDER BY ${referCol} DESC
      LIMIT ${limit}
    `;
  }

  // 指定游戏类型 / 全部小游戏 / 全平台：都按总下载数 download_count 排序
  const whereParts = [`crawled_at = '${windowStr}'`];
  if (typeWhere) whereParts.push(typeWhere);
  if (referAll) whereParts.push('download_count > 0');
  return `
    SELECT
      app_id,
      crawled_at,
      ${referExpr} as refer,
      distribution_type,
      total_download_count,
      download_count,
      ${HOURLY_META_COLS}
    FROM ${HOURLY_TABLE}
    WHERE ${whereParts.join(' AND ')}
    ORDER BY download_count DESC
    LIMIT ${limit}
  `;
}

/** 今日实时汇总 SQL（SQLite 的 dws_taptap_download_summary_hourly，聚合当天已入库小时；含平台与小游戏） */
export function buildTodayRealtimeSummarySql(ref = new Date()) {
  const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const today = fmt(new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()));
  return `
    SELECT
      MAX(crawled_at) AS latest_hour,
      SUM(app_download_count) AS app_download_count,
      SUM(pc_download_count) AS pc_download_count,
      SUM(mini_download_count) AS mini_download_count,
      SUM(tmk_download_count) AS tmk_download_count
    FROM dws_taptap_download_summary_hourly
    WHERE crawled_at >= '${today} 00'
      AND crawled_at <= '${today} 23'
  `;
}

/**
 * 构建「某游戏某日按小时的下载趋势」SQL（明细表下载数后的趋势图标用）
 * @param {string|number} appId 游戏 ID
 * @param {string} day 日期，形如 2026-11-07（取统计窗口的日期部分）
 * @param {string} metric 取值列：app_download_count / pc_download_count / download_count
 */
export function buildAppHourTrendSql(appId, day, metric = 'download_count') {
  const id = String(appId ?? '').trim();
  const col = ['app_download_count', 'pc_download_count', 'download_count'].includes(metric) ? metric : 'download_count';
  if (!/^\d+$/.test(id)) return `SELECT crawled_at, 0 as value FROM ${HOURLY_TABLE} WHERE 1 = 0`;
  return `
    SELECT crawled_at, SUM(${col}) as value
    FROM ${HOURLY_TABLE}
    WHERE app_id = ${id}
      AND crawled_at >= '${day} 00'
      AND crawled_at <= '${day} 23'
    GROUP BY crawled_at
    ORDER BY crawled_at
  `;
}

/** 构建最新数据时间 SQL（用于避免数据更新期间空白） */
export function buildNewestDateSql() {
  const dateStr = recentDaysWhere(7);
  return `
    SELECT MAX(crawled_at) AS newest_datestr
    FROM ${HOURLY_TABLE}
    WHERE crawled_at >= '${dateStr}'
  `;
}
