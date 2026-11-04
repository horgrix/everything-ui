import axios from 'axios';

/**
 * 访问统计接口（PV / UV）
 * - POST {base}/hit      上报一次页面浏览
 * - GET  {base}/week     老契约：本周 PV / UV + 分路径 Top3
 * - GET  {base}/summary  新契约：?range=week|7d|30d|today|all，多返回 series 曲线
 * 前端统一走 /summary（range=week 时 pv/uv/top_paths 与 /week 完全一致），
 * 这样切换时间窗口只是换个参数，不用维护两套解析。
 * 后端异常时统一静默失败：上报不重试、不抛错；读取失败由组件自行隐藏。
 * 接口未就绪时可用 VITE_STATS_MOCK=true 走本地 mock（仅 .env 开发环境开启，生产构建不含）。
 */
// 默认走同源相对路径（生产由 nginx 把 /api/stats 转发到后端，开发由 Vite proxy 转发）
const baseURL = import.meta.env.VITE_STATS_BASE_URL || '/api/stats';
// 仅在开发环境生效：即使生产误配了 VITE_STATS_MOCK，也不会用假数据
const USE_MOCK = import.meta.env.DEV && import.meta.env.VITE_STATS_MOCK === 'true';

const statsClient = axios.create({
  baseURL,
  timeout: 8000,
  // 统一带 Accept: application/json —— 未登录时网关返回 401 而不是登录页 HTML
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

/** 本地兜底游客 id 的存储键（SSO 身份头缺失时后端才会用到） */
const VISITOR_ID_KEY = 'hx_visitor_id';
/** 最近一次 /hit 的 identity（sso|cid|fp），用于 hover 面板显示「身份来源」 */
const IDENTITY_KEY = 'hx_identity';
/** 后端约定：8~64 位 [A-Za-z0-9_-] */
const VISITOR_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

/** 生成一个符合约定的随机 id（crypto 不可用时退化到 Math.random） */
function randomVisitorId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID().replace(/-/g, '');
    }
  } catch {
    /* 非安全上下文等情况走下面的兜底 */
  }
  let out = '';
  while (out.length < 32) out += Math.random().toString(36).slice(2);
  return out.slice(0, 32);
}

/**
 * 取访客兜底 id：优先复用 localStorage 里的值，格式不符则重新生成。
 * 注意：这是"SSO 头缺失时"的兜底，正常情况下后端会优先用 X-Auth-Request-User。
 */
export function getVisitorId() {
  try {
    const saved = window.localStorage.getItem(VISITOR_ID_KEY);
    if (saved && VISITOR_ID_RE.test(saved)) return saved;
    const next = randomVisitorId();
    window.localStorage.setItem(VISITOR_ID_KEY, next);
    return next;
  } catch {
    // 隐私模式 / 禁用存储：不写入，退化成一次性 id
    return randomVisitorId();
  }
}

/** 拆掉 {code,message,data} 包装；code 非 0 视为失败 */
function unwrap(response) {
  const body = response?.data;
  if (body && typeof body === 'object' && body.code !== undefined && body.code !== 0) {
    throw new Error(body.message || `stats api error (code: ${body.code})`);
  }
  return body?.data ?? null;
}

/**
 * 徽章可选的统计窗口，与后端 `/summary?range=` 一一对应。
 * 默认 `week`：保持「不带参数 = 本周」的老行为，导航栏数字不会因为上线这个改动而跳变。
 */
export const STATS_RANGES = [
  { value: 'today', label: '今天' },
  { value: 'week', label: '本周' },
  { value: '7d', label: '近 7 天' },
  { value: '30d', label: '近 30 天' },
  { value: 'all', label: '全部' },
];

export const DEFAULT_RANGE = 'week';

/** range → 中文标签（hover 面板、tooltip 复用） */
export function rangeLabel(range) {
  return STATS_RANGES.find((item) => item.value === range)?.label || range || '';
}

/** 本周一（本地时区，YYYY-MM-DD）——mock 用，与后端口径一致 */
function thisMonday() {
  const now = new Date();
  const diff = (now.getDay() + 6) % 7;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** mock 窗口长度与粒度（与后端 resolve_window 保持一致：≤180 天才按天） */
const MOCK_DAYS = { today: 1, week: 7, '7d': 7, '30d': 30, all: 120 };

/** 身份来源键：后端恒给这三项（缺失/未知一律补 0），用于展示 PV 拆分 */
export const IDENTITY_KEYS = ['sso', 'cid', 'fp'];

/** 与后端完全同形状的 mock 响应（走同一套 unwrap / 字段解析，便于真接口上线后零改动切换） */
function mockEnvelope(range) {
  const name = MOCK_DAYS[range] ? range : DEFAULT_RANGE;
  const days = MOCK_DAYS[name];
  const pad = (n) => String(n).padStart(2, '0');
  const series = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const pv = 120 + ((i * 37) % 90) + (i % 3 === 0 ? 40 : 0);
    series.push({
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      pv,
      uv: Math.max(4, Math.round(pv / 9)),
    });
  }
  const sum = (key) => series.reduce((acc, item) => acc + item[key], 0);
  const pv = sum('pv');
  return {
    code: 0,
    message: 'success',
    data: {
      range: name,
      start: series[0].date,
      end: series[series.length - 1].date,
      granularity: 'day',
      week_start: thisMonday(),
      pv,
      uv: sum('uv'),
      series,
      // 身份来源拆分：三项恒存在、和等于 pv（与后端 identities 同形状）
      identities: { sso: Math.round(pv * 0.86), cid: Math.round(pv * 0.12), fp: pv - Math.round(pv * 0.86) - Math.round(pv * 0.12) },
      top_paths: [
        { path: '/taptap', pv: 642, uv: 58 },
        { path: '/business', pv: 331, uv: 41 },
        { path: '/taprep-monthly', pv: 148, uv: 19 },
      ],
    },
  };
}

/**
 * 上报一次页面浏览（失败静默，绝不阻塞页面）
 * @param {{ path: string, title?: string, referrer?: string }} payload
 */
export function sendHit({ path, title, referrer }) {
  if (!path) return Promise.resolve();
  if (USE_MOCK) return Promise.resolve(); // mock 模式不上报，避免污染真实统计

  // 自测/演示时在地址栏带 ?no_track=1，本次访问不计入统计（后端已支持该参数与 X-No-Track 头）
  const noTrack = typeof window !== 'undefined' && /[?&]no_track=1(&|$)/.test(window.location.search);

  return statsClient
    .post(
      noTrack ? '/hit?no_track=1' : '/hit',
      {
        path,
        // title 不入库，referrer 服务端截到 255：这里先自己截，少传无用字节
        title: (title || document.title || '').slice(0, 255),
        referrer: (referrer ?? (document.referrer || '')).slice(0, 255),
        // 可选兜底：SSO 身份头缺失时后端才用（8~64 位 [A-Za-z0-9_-]）
        visitor_id: getVisitorId(),
      },
      noTrack ? { headers: { 'X-No-Track': '1' } } : undefined,
    )
    .then((res) => {
      // 后端在 /hit 响应里回 identity（sso / cid / fp），记下来供徽章 hover 显示
      const identity = res?.data?.data?.identity;
      if (identity) saveIdentity(identity);
    })
    .catch(() => {});
}

/** 记住后端实际采用的身份来源 */
function saveIdentity(identity) {
  lastIdentity = String(identity);
  try {
    window.localStorage.setItem(IDENTITY_KEY, lastIdentity);
  } catch {
    /* 隐私模式忽略 */
  }
}

let lastIdentity = '';
try {
  lastIdentity = window.localStorage.getItem(IDENTITY_KEY) || '';
} catch {
  /* ignore */
}

/** 最近一次上报时后端采用的身份来源：sso / cid / fp；未知返回空串 */
export function getLastIdentity() {
  return lastIdentity;
}

/**
 * 读某个时间窗口的统计（含 series 曲线）
 * @param {'today'|'week'|'7d'|'30d'|'all'} range
 * @returns {Promise<{ range: string, start: string, end: string, granularity: 'day'|'month',
 *   weekStart: string, pv: number, uv: number,
 *   series: Array<{date:string, pv:number, uv:number}>,
 *   topPaths: Array<{path:string, pv:number, uv:number}>, identities: object, mock: boolean }>}
 */
export async function fetchStats(range = DEFAULT_RANGE) {
  const name = STATS_RANGES.some((item) => item.value === range) ? range : DEFAULT_RANGE;
  let raw;
  if (USE_MOCK) {
    raw = mockEnvelope(name);
  } else {
    try {
      raw = (await statsClient.get('/summary', { params: { range: name } })).data;
    } catch (error) {
      // 4xx（未登录 / 参数错）/ 5xx 都视为「暂时拿不到」：给个不重试的标记，让 UI 直接隐藏徽章
      const status = error?.response?.status;
      const err = new Error(status ? `stats unavailable (${status})` : 'stats unavailable');
      err.noRetry = true;
      throw err;
    }
  }
  const data = unwrap({ data: raw });
  if (!data) throw new Error('empty stats payload');

  // PV 按身份来源拆分（sso / cid / fp）：后端三项恒存在、和等于 pv，缺字段时补 0
  const identities = {};
  IDENTITY_KEYS.forEach((key) => {
    identities[key] = Number(data.identities?.[key]) || 0;
  });

  return {
    range: data.range || name,
    start: data.start || '',
    end: data.end || '',
    // 'month' 表示跨度过大后端已切月粒度，date 形如 YYYY-MM
    granularity: data.granularity === 'month' ? 'month' : 'day',
    weekStart: data.week_start || '',
    pv: Number(data.pv) || 0,
    uv: Number(data.uv) || 0,
    identities,
    // 后端已「缺数据补 0」铺满整个窗口，这里只做数值兜底
    series: (Array.isArray(data.series) ? data.series : []).map((item) => ({
      date: String(item?.date || ''),
      pv: Number(item?.pv) || 0,
      uv: Number(item?.uv) || 0,
    })),
    topPaths: (Array.isArray(data.top_paths) ? data.top_paths : []).map((item) => ({
      path: item?.path || '',
      pv: Number(item?.pv) || 0,
      uv: Number(item?.uv) || 0,
    })),
    mock: USE_MOCK,
  };
}

/** 老名字保留（等价于 range=week），避免其他调用点 import 报错 */
export function fetchWeekStats() {
  return fetchStats('week');
}
