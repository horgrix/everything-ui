/**
 * 各后端 API 的 baseURL 与鉴权开关（统一从这里取，避免散落硬编码）
 *
 * 默认值＝现在的线上地址，行为与之前完全一致；
 * 等网关（nginx + oauth2-proxy）就绪后，只要把环境变量改成**同源相对路径**即可，
 * 代码无需再改：
 *
 *   VITE_API_BASE_URL=/api/data
 *   VITE_V09_API_BASE_URL=/api/v09/data
 *   VITE_QUANT_API_BASE_URL=/api/v1
 *   VITE_FINANCIAL_API_BASE_URL=/api/v2/financial
 *   VITE_AUTH_MODE=sso
 *
 * 同源的好处：网关的登录 Cookie 自动携带、没有跨域 / CORS / SameSite 问题、
 * bundle 里也不再暴露后端子域。
 */

const env = import.meta.env;

/** 业务报表通用查询（horgrix.com/api/data） */
export const API_BASE = env.VITE_API_BASE_URL || 'https://horgrix.com/api/data';

/** v09 数据服务（MySQL，api.horgrix.com/api/v09/data） */
export const V09_API_BASE = env.VITE_V09_API_BASE_URL || 'https://api.horgrix.com/api/v09/data';

/** 量化接口（api.horgrix.com/api/v1） */
export const QUANT_API_BASE = env.VITE_QUANT_API_BASE_URL || 'https://api.horgrix.com/api/v1';

/** 财务接口（api.horgrix.com/api/v2/financial） */
export const FINANCIAL_API_BASE = env.VITE_FINANCIAL_API_BASE_URL || 'https://api.horgrix.com/api/v2/financial';

/**
 * 鉴权模式：'off'（默认，行为不变）| 'sso'（走网关 oauth2-proxy）
 * 运维把 nginx auth_request 接好、把 API 改成同源路径后，再置为 sso。
 */
export const AUTH_MODE = env.VITE_AUTH_MODE === 'sso' ? 'sso' : 'off';

/** oauth2-proxy 的标准路径（挂在站点根，不经任何子路径前缀）；Keycloak 的两个地址供退出时终结 SSO 会话 */
export const SSO = {
  signIn: '/oauth2/sign_in',
  // 清掉 oauth2-proxy 自己的 Cookie。必须带 rd：不带时 oauth2-proxy 会 302 回自身，浏览器"重定向过多"
  signOut: '/oauth2/sign_out',
  auth: '/oauth2/userinfo',
  // Keycloak realm 的登出端点：只清网关 Cookie 不够——Keycloak 侧的 SSO 会话还在，
  // 下次打开页面会静默重新登录（看不到密码框），看起来就是"退出无效"。
  issuerLogout: 'https://sso.horgrix.com/realms/horgrix/protocol/openid-connect/logout',
  clientId: 'oauth2-proxy',
};

/**
 * 所有请求统一带 Accept: application/json。
 * 这是和网关的约定：带此头的请求未登录时返回 **401**（而不是 302 到登录页的 HTML），
 * 前端才能可靠地区分「没登录」和「接口错」，也不会把登录页 HTML 当 JSON 解析。
 */
export const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};
