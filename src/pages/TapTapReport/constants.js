/**
 * TapTap 报表公共常量
 *
 * 这里集中三套「共享语义」的映射，避免各页面各写一份、色值漂移：
 *  - GAME_TYPE_META：distribution_type（0/1/2）→ 文案 + 配色
 *  - PLATFORM_COLORS：refer（app / pc / app+pc）→ 配色
 *  - TAP_COLORS：图表系列常用色（取自全局色库 AD_MATERIAL_COLORS）
 */

/** 游戏类型（distribution_type）→ 文案与配色 */
export const GAME_TYPE_META = {
  0: { label: '商业游戏', color: '#8FA3B0' },
  1: { label: '独立小游戏', color: '#C9B79C' },
  2: { label: 'Maker小游戏', color: '#B9A2AE' },
};

/** 游戏类型 → 文案（0/1/2 → 商业游戏 / 独立小游戏 / Maker小游戏） */
export const GAME_TYPE_LABELS = Object.fromEntries(
  Object.entries(GAME_TYPE_META).map(([k, v]) => [k, v.label])
);

/** 游戏类型 → 徽章配色（与 GAME_TYPE_META 一致，单独导出便于表格列直接用） */
export const GAME_TYPE_BADGE_COLORS = Object.fromEntries(
  Object.entries(GAME_TYPE_META).map(([k, v]) => [k, v.color])
);

/** 游戏类型在图表里的系列配色（商业 / 独立 / Maker） */
export const GAME_TYPE_SERIES_COLORS = ['#8FA3B0', '#B08B8B', '#9B93A8'];

/** 平台（refer）→ 配色；app+pc 用暖色区分 */
export const PLATFORM_COLORS = { app: '#7A8B99', pc: '#9CAF9F', 'app+pc': '#B08B8B' };

/** 平台系列配色顺序：[APP, PC]，用于堆叠/对照图 */
export const PLATFORM_SERIES_COLORS = [PLATFORM_COLORS.app, PLATFORM_COLORS.pc];

/** 图表统一中性色（次要文字、参考线、图例色块兜底） */
export const CHART_MUTED = '#A7B0B8';
