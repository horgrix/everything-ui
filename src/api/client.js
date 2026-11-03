import axios from 'axios';
import { API_BASE, COMMON_HEADERS } from './config';
import { handleResponseError } from './authNotice';

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: COMMON_HEADERS,
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 鉴权不在这里做：凭据是网关下发的 HttpOnly Cookie（同源自动携带），
    // 前端不持有 token、不写 Authorization。失效处理见 authNotice.js。
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器 — 适配 {code, message, data, total} 格式
apiClient.interceptors.response.use(
  (response) => {
    const body = response.data; // {code: 0, message: "success", data: [...], total: N}
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

export default apiClient;