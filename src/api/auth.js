/**
 * 网关 SSO 前端唯一入口（人 → nginx auth_request → oauth2-proxy → IdP）
 *
 * 三条统一约定（与运维一致的边界）：
 * 1. 前端**不自建登录页、不收密码、不存 token**。凭据只有 HttpOnly Cookie，由网关下发。
 * 2. 只有两件事要前端做：会话失效时把人送到 /oauth2/sign_in?rd=<当前地址>；页头提供退出（/oauth2/sign_out）。
 * 3. 全部走同源相对路径（见 config.js），网关 Cookie 自动携带，无 CORS / SameSite 问题。
 *
 * 开关：VITE_AUTH_MODE=sso 才启用。默认 off，即本地与当前线上行为完全不变，
 * 等运维把 nginx + oauth2-proxy 接好后改一行环境变量即可上线，代码不动。
 */
import { AUTH_MODE, SSO } from './config';

/** 是否启用网关 SSO。off 时本模块所有动作都是 no-op，不会跳转、不会弹提示 */
export const isAuthEnabled = () => AUTH_MODE === 'sso';

/** 防重复跳转：一屏几十个请求同时 401 时只跳一次 */
let redirecting = false;
/** 防跳转死循环：刚跳过但又被判未授权，就只提示不再跳 */
const LOOP_KEY = 'auth:redirected-at';
const LOOP_WINDOW_MS = 20_000;

function recentlyRedirected() {
  try {
    const at = Number(sessionStorage.getItem(LOOP_KEY) || 0);
    return at > 0 && Date.now() - at < LOOP_WINDOW_MS;
  } catch {
    return false;
  }
}

function markRedirected() {
  try {
    sessionStorage.setItem(LOOP_KEY, String(Date.now()));
  } catch {
    /* 隐私模式忽略 */
  }
}

/** 清除防循环标记（会话确认有效后调用） */
export function clearRedirectMark() {
  try {
    sessionStorage.removeItem(LOOP_KEY);
  } catch {
    /* ignore */
  }
}

/** 登录地址；rd 默认当前完整地址，登录后回到原页面 */
export function signInUrl(rd) {
  const back = rd || (typeof window !== 'undefined' ? window.location.href : '/');
  return `${SSO.signIn}?rd=${encodeURIComponent(back)}`;
}

/**
 * 送到网关登录页。
 * @returns {boolean} 是否已经/正在跳转（false 表示未启用 SSO，调用方照常处理错误）
 */
export function redirectToSignIn(rd) {
  if (!isAuthEnabled() || typeof window === 'undefined') return false;
  if (redirecting || recentlyRedirected()) return true;
  redirecting = true;
  markRedirected();
  window.location.assign(signInUrl(rd));
  return true;
}

/**
 * 退出：只需一跳 —— oauth2-proxy 的 /oauth2/sign_out 清掉自己下发的 Cookie，再回站点根。
 *
 * 为什么不再额外跳 Keycloak 的 end_session：前端拿不到 id_token_hint，Keycloak 26 对无 hint 的
 * GET logout 只渲染“您确定要注销吗”确认页、不终结会话，而 logout-confirm 在 26.0.8 上会 500，
 * 走不通。改由网关侧 oauth2-proxy 配 prompt="login"：Cookie 一旦清掉，下一次鉴权即使 Keycloak
 * 侧 SSO 会话还在，也必须重新输密码 —— 效果同样是“退出即需重新登录”，且只有一次点击。
 */
export function signOut() {
  if (!isAuthEnabled() || typeof window === 'undefined') return;
  window.location.assign(SSO.signOut);
}

/** 判断一个 axios 错误是否是「未登录 / 登录已过期」 */
export function isUnauthorized(error) {
  const res = error?.response;
  if (!res) return false;
  // 只认 401：网关（nginx auth_request）未登录时给 XHR 回的就是 401 JSON。
  // 403 当普通权限/业务错误处理，不再当会话失效——否则某个接口 403 就把人踢去登录页，跳回来还是 403，白折腾。
  if (res.status === 401) return true;
  // 个别网关会 302 到登录页，axios 跟随后拿到一段 HTML
  const data = res.data;
  if (typeof data === 'string' && /<html|<body|sign_in|登录/i.test(data.slice(0, 400))) return true;
  return false;
}

/**
 * 启动时校验一次会话（每个页面加载只发一次请求，不是每个路由都查）。
 * - 网关已挡在 HTML 之前，正常情况这里必定 200；
 * - 只在「页面开着但 Cookie 过期了」这种边角情况兜底；
 * - 网络异常一律 fail-open，绝不因为探测失败把用户挡在门外。
 * @returns {Promise<{authenticated: boolean, user?: string}>}
 */
export async function checkSession() {
  if (!isAuthEnabled() || typeof window === 'undefined') return { authenticated: true };
  try {
    const res = await fetch(SSO.auth, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      redirect: 'manual',
      cache: 'no-store',
    });
    if (res.status === 200) {
      clearRedirectMark();
      try {
        const body = await res.json();
        return { authenticated: true, user: body?.email || body?.user || '' };
      } catch {
        return { authenticated: true };
      }
    }
    if (res.status === 401) return { authenticated: false };
    // 0 = opaque（被 manual 拦下的 302 登录跳转）
    if (res.type === 'opaqueredirect' || res.status === 0) return { authenticated: false };
    return { authenticated: true };
  } catch {
    return { authenticated: true };
  }
}
