/**
 * 预约统计数据转换
 */

/** 热门预约榜在榜游戏「本日预约新增 TopN」列表（新增预约数按天聚合） */
export function transformReserveTop(rows) {
  return {
    rows: (rows || []).map((r) => ({
      appId: r.app_id,
      appName: r.app_name != null ? String(r.app_name) : '',
      icon: r.icon || '',
      tags: [r.tag_1, r.tag_2, r.tag_3].filter(Boolean).map(String),
      distributionType: r.distribution_type,
      hints: r.hints != null ? String(r.hints) : '',
      totalReserveCount: r.total_reserve_count != null ? Number(r.total_reserve_count) : null,
      dailyReserveCount: r.daily_reserve_count != null ? Number(r.daily_reserve_count) : null,
      pointCount: r.point_cnt != null ? Number(r.point_cnt) : 0,
    })),
  };
}

/** 本日预约新增趋势（按 app_id 分组，供 sparkline 用） */
export function transformReserveTopTrend(rows) {
  const labelSet = new Set();
  const byApp = {};
  (rows || []).forEach((r) => {
    const key = String(r.app_id);
    labelSet.add(String(r.crawled_at).slice(11, 16));
    if (!byApp[key]) byApp[key] = {};
    byApp[key][String(r.crawled_at).slice(11, 16)] = Number(r.reserve_count || 0);
  });
  const labels = [...labelSet].sort();
  return { labels, byApp };
}

/** 热门预约榜在榜游戏预约趋势（预约数走左轴、在榜游戏数走右轴） */
export function transformReserveTrend(rows) {
  if (!rows || !rows.length) return { categories: [], series: [] };
  const sorted = [...rows].sort((a, b) => (a.crawled_at < b.crawled_at ? -1 : 1));
  return {
    categories: sorted.map((r) => r.crawled_at),
    series: [
      { name: '预约数', color: '#7A8B99', data: sorted.map((r) => Number(r.reserve_count || 0)) },
      { name: '游戏数', color: '#9CAF9F', data: sorted.map((r) => Number(r.game_conut || 0)) },
    ],
  };
}
