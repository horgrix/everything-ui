/**
 * 鉴权失效的统一处理（所有 axios 客户端共用，只在这一处落地）
 *
 * 策略：SSO 开启时直接把人送到网关登录页（redirectToSignIn），
 * 只有「刚跳过又被判未授权」这种异常循环才退回顶部提示条，避免无限跳转。
 * SSO 关闭（默认）时什么都不做，只在控制台留一行 warn，开发期不干扰。
 *
 * 纯 DOM 实现，不依赖 React 上下文，所以在 axios 拦截器里也能用。
 */
import { isUnauthorized, isAuthEnabled, redirectToSignIn } from './auth';

export { isUnauthorized };

let bannerEl = null;

/** 同一条提示的最小间隔，避免一屏几十个请求同时失败时刷屏 */
const MIN_INTERVAL_MS = 60_000;
let lastShownAt = 0;

function removeBanner() {
  if (bannerEl && bannerEl.parentNode) bannerEl.parentNode.removeChild(bannerEl);
  bannerEl = null;
}

/** 顶部提示：登录状态失效，点「重新登录」由网关接管跳转 */
export function notifyAuthRequired(text = '登录状态已失效，请重新登录后继续使用') {
  const now = Date.now();
  if (now - lastShownAt < MIN_INTERVAL_MS) return;
  lastShownAt = now;

  if (typeof document === 'undefined' || !document.body) return;
  removeBanner();

  const box = document.createElement('div');
  box.setAttribute('role', 'alert');
  box.style.cssText = [
    'position:fixed',
    'top:16px',
    'left:50%',
    'transform:translateX(-50%)',
    'z-index:9999',
    'display:flex',
    'align-items:center',
    'gap:12px',
    'max-width:calc(100vw - 32px)',
    'padding:10px 14px',
    'background:#2B3439',
    'color:#fff',
    'border-radius:12px',
    'box-shadow:0 8px 24px rgba(16,24,40,.22)',
    'font-size:12.5px',
    'line-height:1.5',
  ].join(';');

  const icon = document.createElement('span');
  icon.textContent = '🔒';
  icon.style.cssText = 'font-size:14px;flex:0 0 auto';

  const msg = document.createElement('span');
  msg.textContent = text;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '重新登录';
  btn.style.cssText = [
    'flex:0 0 auto',
    'border:1px solid rgba(255,255,255,.35)',
    'background:transparent',
    'color:#fff',
    'font-size:12px',
    'padding:4px 12px',
    'border-radius:8px',
    'cursor:pointer',
  ].join(';');
  btn.onclick = () => {
    removeBanner();
    // 强制重跳时清掉防循环标记，用户主动点击必须生效
    try {
      sessionStorage.removeItem('auth:redirected-at');
    } catch {
      /* ignore */
    }
    if (!redirectToSignIn()) window.location.reload();
  };

  const close = document.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', '关闭');
  close.textContent = '×';
  close.style.cssText =
    'flex:0 0 auto;border:0;background:transparent;color:rgba(255,255,255,.6);font-size:16px;line-height:1;cursor:pointer;padding:0 2px';
  close.onclick = removeBanner;

  box.append(icon, msg, btn, close);
  document.body.appendChild(box);
  bannerEl = box;
}

/**
 * axios 响应错误的统一处理：命中鉴权失效就送登录页（或兜底提示），然后照常 reject。
 * @param {Error} error axios 错误
 * @param {string} tag 日志前缀，便于区分是哪个 API
 */
export function handleResponseError(error, tag = 'API') {
  if (!isUnauthorized(error)) return error;

  if (isAuthEnabled()) {
    // 正常情况：标记 + 跳转，页面马上就走了
    if (redirectToSignIn()) {
      // redirectToSignIn 返回 true 有两种：正在跳 / 刚跳过了（疑似循环）
      // 后者不会有页面跳转发生，用提示条兜底，让用户手动点
      setTimeout(() => notifyAuthRequired(), 1200);
    }
  } else {
    console.warn(`[${tag}] 401/403 —— 网关鉴权未启用（VITE_AUTH_MODE=off），按普通接口错误处理`);
  }
  return error;
}
