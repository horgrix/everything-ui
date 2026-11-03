import axios from 'axios';
import { FINANCIAL_API_BASE, COMMON_HEADERS } from './config';
import { handleResponseError } from './authNotice';

const finClient = axios.create({
  baseURL: FINANCIAL_API_BASE,
  timeout: 30000,
  headers: COMMON_HEADERS,
});

finClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    handleResponseError(error, 'Finance API');
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
