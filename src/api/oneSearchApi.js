import createV09Client from './v09Client';

/**
 * One Search 专用聚合接口（everything-api，`/api/v09/data/search`）
 *
 * 详情页的趋势图不再让前端拼 SQL 查 MySQL，统一走后端聚合。
 */
const searchClient = createV09Client('/search', import.meta.env.VITE_SEARCH_API_BASE_URL);

/**
 * 某游戏最近 N 天的预约趋势
 * @param {number|string} appId TapTap APPID
 * @param {number} days 最近 N 天（含今天），默认 30
 * @returns {Promise<{app_id:number, days:number, start:string, end:string,
 *   points:Array<{date:string, added:number|null, total:number|null}>, latest:object|null}>}
 */
export function fetchReserveTrend(appId, days = 30) {
  return searchClient.get('/reserve-trend', { params: { app_id: appId, days } }).then((r) => r.data);
}
