import axios from 'axios';

/** 量化 API 客户端 */
const quantClient = axios.create({
  baseURL: 'https://api.horgrix.com/api/v1',
  timeout: 30000,
});

quantClient.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body.code !== undefined && body.code !== 0) {
      return Promise.reject(new Error(body.message || `Quant API Error (code: ${body.code})`));
    }
    return body;
  },
  (error) => {
    const message = error.response?.data?.message || error.message || '请求失败';
    console.error('[Quant API Error]', message);
    return Promise.reject(new Error(message));
  }
);

export function fetchKline(params = {}) {
  return quantClient.get('/kline', { params });
}

export function fetchIndicators(params = {}) {
  return quantClient.get('/indicator/compute', { params });
}

export function runStrategy(params = {}) {
  return quantClient.get('/strategy/run', { params });
}

export function fetchStrategyList() {
  return quantClient.get('/strategy/list');
}