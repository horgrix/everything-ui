import createV09Client from './v09Client';

/**
 * 首页概览接口（everything-api 服务端聚合，前端不再直连 MySQL 拼 SQL）
 * - GET {base}/active-apps?month=YYYY-MM  本月采集活跃 APP 数（月度快照 + 每日明细）
 * - GET {base}/type-share?month=YYYY-MM   本月游戏类型占比（下载量 / 在线峰值 / 广告曝光）
 * - GET {base}/download-rank?month=YYYY-MM&limit=5  本月下载榜 TopN（top / gain / loss）
 * - GET {base}/ad-rank?month=YYYY-MM&limit=5        本月广告曝光榜 TopN（top / gain / loss）
 *
 * base 默认 `${V09_API_BASE}/home` —— 即 `/api/v09/data/home`，复用现有的
 * `/api/v09/data → everything-api` nginx 反代；需要换地址时用 VITE_HOME_API_BASE_URL 覆盖。
 */
const homeClient = createV09Client('/home', import.meta.env.VITE_HOME_API_BASE_URL);

/** 当前月份（'YYYY-MM'），与后端缺省值口径一致（后端按 Asia/Shanghai） */
export function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 本月采集活跃 APP 数：{ month, monthly, daily, latest_day } */
export function fetchActiveApps(month = currentMonthKey()) {
  return homeClient.get('/active-apps', { params: { month } }).then((r) => r.data);
}

/** 本月下载榜 TopN：{ month, limit, categories:[{key, items[]}] }，key = top / gain / loss */
export function fetchDownloadRank(month = currentMonthKey(), limit = 5) {
  return homeClient.get('/download-rank', { params: { month, limit } }).then((r) => r.data);
}

/** 本月广告曝光榜 TopN：结构同下载榜，数值口径为广告曝光次数 */
export function fetchAdRank(month = currentMonthKey(), limit = 5) {
  return homeClient.get('/ad-rank', { params: { month, limit } }).then((r) => r.data);
}

/** 本月游戏类型占比：{ month, types[], totals, unclassified } */
export function fetchTypeShare(month = currentMonthKey()) {
  return homeClient.get('/type-share', { params: { month } }).then((r) => r.data);
}
