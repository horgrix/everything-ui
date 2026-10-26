import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { sendHit } from '../api/stats';

/** 去重缓存（应用生命周期内有效）：同一路径 1.5 秒内不重复上报 */
let lastHit = { path: '', at: 0 };

/**
 * 每次路由变化上报一次页面浏览（PV）。
 * - SPA 只有一个 index.html，必须在路由变化时手动上报，否则整站只有 1 个 PV
 * - 1.5 秒内同路径的重复上报会被跳过（防止 HMR / 快速重渲染重复计数）
 * - 上报失败静默，不影响页面
 */
export default function usePageviewTracking() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    if (!path) return;

    const now = Date.now();
    if (lastHit.path === path && now - lastHit.at < 1500) return;
    lastHit = { path, at: now };

    sendHit({ path });
  }, [location.pathname]);
}
