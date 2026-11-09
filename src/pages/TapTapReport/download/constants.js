import { AD_MATERIAL_COLORS } from '../shared';
import {
  GAME_TYPE_LABELS,
  GAME_TYPE_BADGE_COLORS,
  PLATFORM_COLORS,
  PLATFORM_SERIES_COLORS,
} from '../constants';
import { HOURLY_TABLE } from '../sql';

/** 明细查询窗口类型（只保留小时；日/月统计已按业务要求去掉） */
export const WINDOW_TYPES = [{ label: '小时', table: HOURLY_TABLE, granularity: 'hour' }];

/** 月趋势拆分图（平台 / 小游戏）配置 */
export const MONTHLY_BREAKDOWN_CHARTS = [
  { key: 'platform', title: '热门游戏TopN下载月趋势(平台) — 最近12个月' },
  { key: 'gameType', title: '热门游戏TopN下载月趋势(小游戏) — 最近12个月' },
];

/** 月趋势两张拆分图各自的配色（APP/PC、独立小游戏/Maker小游戏） */
export const MONTHLY_BREAKDOWN_COLORS = {
  platform: ['#7A8B99', '#9CAF9F'],
  gameType: ['#8FA3B0', '#9B93A8'],
};

/** 追踪的游戏分布拆分图（平台 / 小游戏）配置 */
export const DISTRIBUTION_CHARTS = [
  { key: 'platform', title: '追踪的游戏分布(平台)' },
  { key: 'gameType', title: '追踪的游戏分布(小游戏)' },
];

/** 分布饼图扇区：按色库循环 */
export const DISTRIBUTION_COLORS = AD_MATERIAL_COLORS;

/** 平台拆分配色（APP / PC）与「下载平台」标签配色 */
export const PLATFORM_DOWNLOAD_COLORS = PLATFORM_SERIES_COLORS;
export const PLATFORM_BADGE_COLORS = PLATFORM_COLORS;

/** 游戏类型标签文案与配色（统一取自 constants.GAME_TYPE_*） */
export const DISTRIBUTION_TYPE_LABELS = GAME_TYPE_LABELS;
export const DISTRIBUTION_TYPE_BADGE_COLORS = GAME_TYPE_BADGE_COLORS;

/** 游戏类型联动筛选项：null=全部；顺序与饼图扇区一致 */
export const TYPE_FILTER_OPTIONS = [
  { value: 1, label: DISTRIBUTION_TYPE_LABELS[1] },
  { value: 2, label: DISTRIBUTION_TYPE_LABELS[2] },
];

/** 平台联动筛选项：null=全部 */
export const PLATFORM_FILTER_OPTIONS = [
  { value: 'app', label: 'APP' },
  { value: 'pc', label: 'PC' },
];

/** 饼图「已选中」扇区的描边色（其余扇区留白缝） */
export const SELECTED_SLICE_STROKE = '#2F3A44';

/** 饼图扇区标签 → 筛选项值（APP/PC 或 distribution_type） */
export function labelToFilterValue(distKey, label) {
  if (distKey === 'platform') {
    if (label.includes('APP')) return 'app';
    if (label.includes('PC')) return 'pc';
    return null;
  }
  const key = Object.keys(DISTRIBUTION_TYPE_LABELS).find((k) => DISTRIBUTION_TYPE_LABELS[k] === label);
  return key == null ? null : Number(key);
}

/** 按选中判定生成每个切片的描边色数组（未选中时全为白缝） */
export function buildSliceStrokeColors(labels, isSelected) {
  if (!labels || !labels.length) return null;
  return labels.map((label) => (isSelected(label) ? SELECTED_SLICE_STROKE : '#FFFFFF'));
}

/** 周趋势图表配置（平台 / 小游戏） */
export const WEEKLY_TREND_CHARTS = {
  platform: {
    key: 'platform',
    title: '热门游戏TopN下载日趋势(平台)',
    colors: PLATFORM_DOWNLOAD_COLORS,
    names: ['APP下载数', 'PC端下载数'],
    // 今日那一点优先用 SQLite 实时数据覆盖（MySQL 日表当天数据不完整）
    realtimeKeys: ['app', 'pc'],
    pairs: (d) => [
      [d?.platform?.current?.app, d?.platform?.previous?.app],
      [d?.platform?.current?.pc, d?.platform?.previous?.pc],
    ],
  },
  miniGame: {
    key: 'miniGame',
    title: '热门游戏TopN下载日趋势(小游戏)',
    colors: ['#8FA3B0', '#9B93A8'],
    names: ['独立小游戏下载数', 'Maker小游戏下载数'],
    // 今日那一点优先用 SQLite 实时数据覆盖（MySQL 日表当天数据不完整）
    realtimeKeys: ['nonMaker', 'maker'],
    pairs: (d) => [
      [d?.miniGame?.current?.nonMaker, d?.miniGame?.previous?.nonMaker],
      [d?.miniGame?.current?.maker, d?.miniGame?.previous?.maker],
    ],
  },
};
