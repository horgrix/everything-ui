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

/**
 * v09 服务根（不带 /data）：everything-api 的首页概览等专用聚合接口挂在 `/api/v09/home`，
 * 默认由 V09_API_BASE 去掉尾部 `/data` 得到，也可用 VITE_V09_API_ROOT 单独覆盖。
 */
export const V09_API_ROOT = env.VITE_V09_API_ROOT || V09_API_BASE.replace(/\/+$/, '').replace(/\/data$/, '');

/** 量化接口（api.horgrix.com/api/v1） */
export const QUANT_API_BASE = env.VITE_QUANT_API_BASE_URL || 'https://api.horgrix.com/api/v1';

/** 财务接口（api.horgrix.com/api/v2/financial） */
export const FINANCIAL_API_BASE = env.VITE_FINANCIAL_API_BASE_URL || 'https://api.horgrix.com/api/v2/financial';

/**
 * 鉴权模式：'off'（默认，行为不变）| 'sso'（走网关 oauth2-proxy）
 * 运维把 nginx auth_request 接好、把 API 改成同源路径后，再置为 sso。
 */
export const AUTH_MODE = env.VITE_AUTH_MODE === 'sso' ? 'sso' : 'off';

/**
 * 网关（oauth2-proxy）与退出入口。
 * 注意：退出不要在本 bundle 里拼 Keycloak 地址 —— 整条链路由 nginx 的 GET /logout 负责：
 *   清 oauth2-proxy Cookie → 302 到 Keycloak end_session → 确认页由 sso 侧注入脚本自动提交 → 回站点根。
 * 好处：前端不硬编码 IdP 域名，IdP 换域名/换路径只改 nginx。
 */
export const SSO = {
  signIn: '/oauth2/sign_in',
  // 站点级退出入口（nginx 定义，不经 auth_request）
  signOut: '/logout',
  auth: '/oauth2/userinfo',
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
