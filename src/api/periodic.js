/**
 * 定期报告（周报 / 月报）聚合接口
 *
 * 全部走 everything-api 的 `GET /api/v09/data/periodic/*`（后端已把取数与口径收敛在服务端）：
 *   /periods  可选期列表 + 三条业务线各自有没有数据
 *   /report   一期整篇：核心 KPI（含趋势点 / 可用期数）+ 分型拆解 + 按游戏 + 质量标记
 *   /rank     一期某业务线榜单（top / gain / loss）
 *
 * 前端不再拼 SQL、不再自己判断「上期是哪期」「缺值要不要当 0」——这些都在接口里定死了。
 * 本地开发如果接口不可用（例如没连内网），自动退回 __fixtures__ 里的真实响应快照，
 * 保证样式可以离线打磨；生产构建不会打进这些快照。
 */
import axios from 'axios';
import { V09_API_BASE, COMMON_HEADERS } from './config';
import { handleResponseError } from './authNotice';

const client = axios.create({
  baseURL: `${V09_API_BASE}/periodic`,
  timeout: 20000,
  headers: COMMON_HEADERS,
});

client.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body && body.code !== undefined && body.code !== 0) {
      const err = new Error(body.message || body.msg || `接口错误（code ${body.code}）`);
      // 40000 = 该期还没有数据（周期表尚未生成这一行），页面要区别于「接口挂了」
      err.code = body.code;
      err.noData = body.code === 40000;
      return Promise.reject(err);
    }
    return body?.data;
  },
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message || '请求失败';
    // 一期完全没有数据时接口回 404 / 40000，属于「还没生成」，不是故障
    if (status === 404) {
      const err = new Error(message);
      err.code = error.response?.data?.code;
      err.noData = true;
      handleResponseError(error, 'periodic API');
      return Promise.reject(err);
    }
    handleResponseError(error, 'periodic API');
    return Promise.reject(new Error(message));
  }
);

/* ------------------------------------------------------------------ 开发期快照兜底 */

const fixtureModules = import.meta.env.DEV
  ? import.meta.glob('../pages/PeriodicReport/__fixtures__/*.json')
  : {};

async function fixture(name) {
  const load = fixtureModules[`../pages/PeriodicReport/__fixtures__/${name}.json`];
  if (!load) return null;
  const mod = await load();
  return mod.default?.data ?? mod.data ?? null;
}

/**
 * 真实请求；DEV 下失败时退到快照。
 * @param {string} url
 * @param {Object} params
 * @param {string[]} fallbacks 快照名（按顺序尝试第一个存在的）
 */
async function request(url, params, fallbacks = []) {
  try {
    return await client.get(url, { params });
  } catch (error) {
    for (const name of fallbacks) {
      const data = await fixture(name);
      if (data) {
        // 只在控制台留一行提示，页面照常渲染，不弹错误
        console.warn(`[periodic] ${url} 请求失败，已使用本地快照 ${name}.json：`, error.message);
        return data;
      }
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ 对外接口 */

/** 可选期列表；periodType = weekly | monthly */
export function fetchPeriods(periodType = 'weekly') {
  return request('/periods', { period: periodType }, [`periods-${periodType}`]);
}

/** 一期完整报告；key 缺省 = 最新一期 */
export function fetchReport(periodType = 'weekly', key) {
  return request(
    '/report',
    { period: periodType, ...(key ? { key } : {}) },
    key ? [`report-${periodType}-${key}`, `report-${periodType}-latest`] : [`report-${periodType}-latest`]
  ).then((data) => normalizeTrendLabels(data, periodType));
}

/**
 * 月报的趋势点 label 目前还是周次格式（2026-10 → "W10"），图表 / 工具提示 / 要点句子都会露出来。
 * 这里统一改成「10 月」；周报原样不动（接口给的 W40 就是对的）。后端修好后这段是幂等的。
 */
function normalizeTrendLabels(data, periodType) {
  if (!data || periodType !== 'monthly') return data;
  const monthLabel = (period) => {
    const month = Number(String(period || '').slice(5, 7));
    return Number.isFinite(month) && month > 0 ? `${month} 月` : period;
  };
  const fixTrend = (series) =>
    (series || []).map((point) =>
      point && point.period ? { ...point, label: monthLabel(point.period) } : point
    );
  (data.coreKpis || []).forEach((kpi) => {
    if (kpi.trend) kpi.trend = fixTrend(kpi.trend);
  });
  (data.lines || []).forEach((line) => {
    (line.kpis || []).forEach((kpi) => {
      if (kpi.trend) kpi.trend = fixTrend(kpi.trend);
    });
  });
  return data;
}

/** 预约数据（独立业务线，历史从 2026-11-08 起） */
export function fetchReserve(periodType = 'weekly', key) {
  return request(
    '/reserve',
    { period: periodType, ...(key ? { key } : {}) },
    key ? [`reserve-${periodType}-${key}`, `reserve-${periodType}`] : [`reserve-${periodType}`]
  );
}

/** 榜单；line = download | ad | online，category = top | gain | loss */
export function fetchRank(line, { periodType = 'weekly', key, category = 'top', limit = 8, listType, dist } = {}) {
  const suffix = [line, category, listType].filter(Boolean).join('-');
  return request(
    '/rank',
    {
      line,
      period: periodType,
      ...(key ? { key } : {}),
      category,
      limit,
      ...(listType ? { list_type: listType } : {}),
      ...(dist ? { dist } : {}),
    },
    [`rank-${suffix}`, `rank-${line}-${category}`, `rank-${line}-top`]
  ).then((data) => {
    if (!data) return data;
    // 后端 58714b5：逐行 realHours（该游戏本周期有有效在线的小时数）+ 榜单级 sample 可比性信号。
    // 老接口没有这些字段时保持 null，页面按「无信号」渲染，前端不自己造阈值。
    return {
      ...data,
      sample: data.sample || null,
      items: (data.items || []).map((item) => ({
        ...item,
        realHours: typeof item.realHours === 'number' ? item.realHours : null,
      })),
    };
  });
}
