import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://horgrix.com/api/data',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 可在此添加 token 等认证信息
    // const token = localStorage.getItem('token');
    // if (token) config.headers.Authorization = `Bearer ${token}`;
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
    const message = error.response?.data?.message || error.message || '请求失败';
    console.error('[API Error]', message);
    return Promise.reject(new Error(message));
  }
);

export default apiClient;