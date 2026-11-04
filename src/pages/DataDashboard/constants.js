/**
 * 数据大盘（/dashboard）
 *
 * 数据通道：运维把 xd-reports 导出的 JSON 同步到站内静态目录，前端用相对路径取，
 * 同源、无跨域、无冷启动。默认落点 `/_api/dashboard/`，可用 VITE_DASHBOARD_BASE_URL 覆盖。
 */
export const DASH_BASE = (import.meta.env.VITE_DASHBOARD_BASE_URL || '/_api/dashboard').replace(/\/+$/, '');

/** manifest 文件名：大盘区块的目录，前端完全按它渲染，不写死任何业务区块 */
export const MANIFEST_FILE = 'manifest.json';

/** 区块类型 → 渲染组件 */
export const BLOCK_TYPES = ['kpi', 'trend', 'rank', 'distribution', 'table'];
