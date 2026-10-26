import axios from 'axios';

/**
 * 访问统计接口（PV / UV）
 * - POST {base}/hit   上报一次页面浏览
 * - GET  {base}/week  读本周 PV / UV + 分路径 Top3
 * 后端未上线时统一静默失败：上报不重试、不抛错；读取失败由组件自行隐藏。
 * 接口就绪前可用 VITE_STATS_MOCK=true 走本地 mock（仅 .env 开发环境开启，生产构建不含）。
 */
// 默认走同源相对路径（生产由 nginx 把 /api/stats 转发到后端，开发由 Vite proxy 转发）
const baseURL = import.meta.env.VITE_STATS_BASE_URL || '/api/stats';
// 仅在开发环境生效：即使生产误配了 VITE_STATS_MOCK，也不会用假数据
const USE_MOCK = import.meta.env.DEV && import.meta.env.VITE_STATS_MOCK === 'true';

const statsClient = axios.create({
  baseURL,
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
});

/** 拆掉 {code,message,data} 包装；code 非 0 视为失败 */
function unwrap(response) {
  const body = response?.data;
  if (body && typeof body === 'object' && body.code !== undefined && body.code !== 0) {
    throw new Error(body.message || `stats api error (code: ${body.code})`);
  }
  return body?.data ?? null;
}

/** 本周一（本地时区，YYYY-MM-DD）——mock 用，与后端口径一致 */
function thisMonday() {
  const now = new Date();
  const diff = (now.getDay() + 6) % 7;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 与后端完全同形状的 mock 响应（走同一套 unwrap / 字段解析，便于真接口上线后零改动切换） */
function mockEnvelope() {
  return {
    code: 0,
    message: 'success',
    data: {
      week_start: thisMonday(),
      pv: 1284,
      uv: 92,
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
        title: title || document.title || '',
        referrer: referrer ?? (document.referrer || ''),
      },
      noTrack ? { headers: { 'X-No-Track': '1' } } : undefined,
    )
    .catch(() => {});
}

/**
 * 读本周统计
 * @returns {Promise<{ weekStart: string, pv: number, uv: number, topPaths: Array<{path:string, pv:number, uv:number}>, mock: boolean }>}
 */
export async function fetchWeekStats() {
  const raw = USE_MOCK ? mockEnvelope() : (await statsClient.get('/week')).data;
  const data = unwrap({ data: raw });
  if (!data) throw new Error('empty stats payload');

  return {
    weekStart: data.week_start || '',
    pv: Number(data.pv) || 0,
    uv: Number(data.uv) || 0,
    topPaths: (Array.isArray(data.top_paths) ? data.top_paths : []).map((item) => ({
      path: item?.path || '',
      pv: Number(item?.pv) || 0,
      uv: Number(item?.uv) || 0,
    })),
    mock: USE_MOCK,
  };
}
