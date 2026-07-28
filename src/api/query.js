import apiClient from './client';

/**
 * 通用查询函数 — 对应 https://horgrix.com/api/data/{table_name}/query
 *
 * @param {string} tableName - 数据表名
 * @param {Object} params - 查询参数
 * @param {string} params.fields - 逗号分隔的字段，默认 "*"
 * @param {string} params.where - JSON 过滤条件: [{"col":"price","op":">","value":100}]
 * @param {string} params.group_by - GROUP BY 字段
 * @param {string} params.order_by - ORDER BY，默认 "crawled_at DESC"
 * @param {number} params.limit - 行数限制，默认 100，最大 9999
 * @param {number} params.offset - 偏移量
 * @param {string} params.aggregate - 聚合: "SUM(col) as total, COUNT(*) as cnt"
 *
 * @returns {Promise<{data: Array<Object>, total: number}>}
 */
export default function query(tableName, params = {}) {
  const queryParams = { ...params };

  // 将 where 数组序列化为 JSON 字符串
  if (Array.isArray(queryParams.where)) {
    queryParams.where = JSON.stringify(queryParams.where);
  }

  return apiClient.get(`/${tableName}/query`, { params: queryParams });
}