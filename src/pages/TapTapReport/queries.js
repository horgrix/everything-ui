import { useMemo } from 'react';
import useChartData from '../../hooks/useChartData';
import { querySql, querySqlV09 } from '../../api/query';

/**
 * 通用 SQL 查询 hook：封装 useMemo(sql) + useChartData + querySql 样板
 * @param {string} key react-query 缓存键
 * @param {() => string} getSql SQL 构建函数
 * @param {Array} deps getSql 的依赖数组（同 useMemo）
 * @param {(rows, total) => any} transform 数据转换
 * @param {object} options 额外 useChartData 选项（enabled 等）
 */
export function useSqlQuery(key, getSql, deps, transform, options = {}) {
  const sql = useMemo(getSql, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return useChartData(key, (p) => querySql(p.sql), { sql }, { transform, ...options });
}

/**
 * 同 useSqlQuery，但走 v09 数据服务（MySQL，api.horgrix.com/api/v09/data）
 * @param {string} key react-query 缓存键
 * @param {() => string} getSql SQL 构建函数（MySQL 语法）
 * @param {Array} deps getSql 的依赖数组
 * @param {(rows, total) => any} transform 数据转换
 * @param {object} options 额外 useChartData 选项
 */
export function useSqlQueryV09(key, getSql, deps, transform, options = {}) {
  const sql = useMemo(getSql, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return useChartData(key, (p) => querySqlV09(p.sql), { sql }, { transform, ...options });
}
