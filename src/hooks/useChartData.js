import { useQuery } from '@tanstack/react-query';

/**
 * 通用图表数据获取 Hook
 *
 * @param {string} queryKey - react-query 缓存 key
 * @param {Function} queryFn - 查询函数，应返回 {data, total}
 * @param {Object} params - 请求参数（用于缓存 key 变化检测）
 * @param {Object} options - 额外配置
 * @param {Function} options.transform - 可选的数据转换函数 (rows) => chartData
 * @param {number} options.staleTime - 缓存有效期
 * @param {boolean} options.enabled - 是否启用查询
 */
export default function useChartData(queryKey, queryFn, params = {}, options = {}) {
  const { transform, ...restOptions } = options;

  return useQuery({
    queryKey: [queryKey, params],
    queryFn: async () => {
      const result = await queryFn(params);
      const rows = result.data;       // list[dict]
      const total = result.total;     // 总行数
      if (transform) {
        return transform(rows, total);
      }
      return { rows, total };
    },
    staleTime: restOptions.staleTime ?? 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
    ...restOptions,
  });
}