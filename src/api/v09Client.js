import axios from 'axios';
import { V09_API_BASE, COMMON_HEADERS } from './config';
import { handleResponseError } from './authNotice';

/**
 * everything-api 专用聚合接口（v09）的 axios 实例工厂。
 *
 * 这些接口都挂在 `/api/v09/data/<子路径>` 下，复用现有 nginx 的 `/api/v09/data → everything-api` 反代；
 * 返回统一是 `{code, message, data, total}`，这里解包成 `{data, total}`，与 `apiClient` 行为一致。
 *
 * @param {string} subPath 子路径，如 '/home'、'/search'
 * @param {string} [overrideBase] 覆盖 baseURL（测试或换环境用）
 */
export default function createV09Client(subPath, overrideBase) {
  const base = (overrideBase || `${V09_API_BASE.replace(/\/+$/, '')}${subPath}`);

  const client = axios.create({
    baseURL: base,
    timeout: 20000,
    headers: COMMON_HEADERS,
  });

  client.interceptors.response.use(
    (response) => {
      const body = response.data;
      if (body.code !== undefined && body.code !== 0) {
        return Promise.reject(new Error(body.message || `API Error (code: ${body.code})`));
      }
      return { data: body.data, total: body.total };
    },
    (error) => {
      handleResponseError(error, 'API');
      const message = error.response?.data?.message || error.message || '请求失败';
      console.error('[API Error]', message);
      return Promise.reject(new Error(message));
    }
  );

  return client;
}
