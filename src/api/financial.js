import axios from 'axios';

const finClient = axios.create({
  baseURL: '/api/v2/financial',
  timeout: 30000,
});

finClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || error.message || '请求失败';
    console.error('[Finance API Error]', message);
    return Promise.reject(new Error(message));
  }
);

function serializeParams(p) {
  const parts = [];
  for (const [key, val] of Object.entries(p)) {
    if (Array.isArray(val)) val.forEach((v) => parts.push(`${key}=${v}`));
    else parts.push(`${key}=${val}`);
  }
  return parts.join('&');
}

export function fetchCoreFinancialReport(params = {}) {
  return finClient.get('/xd/core-financial-report', { params, paramsSerializer: serializeParams });
}

export function fetchBalanceReport(params = {}) {
  return finClient.get('/xd/balance-report', { params, paramsSerializer: serializeParams });
}

export function fetchExpenseReport(params = {}) {
  return finClient.get('/xd/expense-report', { params, paramsSerializer: serializeParams });
}

export function fetchOperationalReport(params = {}) {
  return finClient.get('/xd/core-operational-report', { params, paramsSerializer: serializeParams });
}

export function fetchRevenueReport(params = {}) {
  return finClient.get('/xd/revenue-report', { params, paramsSerializer: serializeParams });
}

export function fetchRevenueGameReport(params = {}) {
  return finClient.get('/xd/revenue-game-report', { params, paramsSerializer: serializeParams });
}
