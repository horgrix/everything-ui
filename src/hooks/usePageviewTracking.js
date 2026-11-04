import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { sendHit } from '../api/stats';

/**
 * 同路径去重窗口：30 分钟内重复进入同一个页面不再上报。
 * 后端 v2 起 PV = 明细行数、服务端不再去重，所以「防重复」只剩前端这一层：
 * 刷新、在几个报表之间来回切、StrictMode 双跑 effect 都会凭空翻 PV。
 * 30 分钟与清库前的老口径一致，数字和以前可横向对比；想还原生计数把这里改成 0 即可。
 */
const DEDUP_WINDOW_MS = 30 * 60 * 1000;
/** 去重记录存 localStorage：跨标签页、跨刷新都有效 */
const DEDUP_KEY = 'hx_pv_last_hit';

/** 内存镜像：localStorage 不可用（隐私模式 / 写满）时退化成只在本次会话生效 */
let memo = {};

/** 读出未过期的去重记录（每次现读，保证多标签页之间也能互相看到） */
function loadSeen(now) {
  const seen = { ...memo };
  try {
    const raw = window.localStorage.getItem(DEDUP_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      Object.entries(parsed).forEach(([path, ts]) => {
        const n = Number(ts);
        // 丢掉过期记录，顺便不让这个 key 无限膨胀
        if (Number.isFinite(n) && now - n < DEDUP_WINDOW_MS) seen[path] = n;
      });
    }
  } catch {
    // 存储不可用：用内存镜像顶着
  }
  return seen;
}

function saveSeen(seen) {
  memo = seen;
  try {
    window.localStorage.setItem(DEDUP_KEY, JSON.stringify(seen));
  } catch {
    /* 写不进去就只在内存里生效 */
  }
}

/** 该路径是否在去重窗口内已上报过；未过期则记录本次并返回 true（调用方跳过上报） */
function isDuplicate(path, now = Date.now()) {
  if (DEDUP_WINDOW_MS <= 0) return false;
  const seen = loadSeen(now);
  const last = seen[path];
  if (last && now - last < DEDUP_WINDOW_MS) return true;
  seen[path] = now;
  saveSeen(seen);
  return false;
}

/**
 * 每次路由变化上报一次页面浏览（PV）。
 * - SPA 只有一个 index.html，必须在路由变化时手动上报，否则整站只有 1 个 PV
 * - 同一路径 30 分钟内只上报一次（见 DEDUP_WINDOW_MS）
 * - 上报失败静默，不影响页面
 */
export default function usePageviewTracking() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    if (!path) return;
    if (isDuplicate(path)) return;

    sendHit({ path });
  }, [location.pathname]);
}
