import { GAME_TYPE_META } from '../../constants';

/**
 * TapPC 在线人数数据转换（峰值 / 分布 / Top80）
 */

/** TapPC热玩游戏榜在线人数趋势（分组堆叠柱状：峰值玩家数 + 统计游戏数双组双轴） */
export function transformOnlinePlayersTrend(rows) {
  if (!rows || !rows.length) return { series: [], categories: [] };
  const sorted = [...rows].sort((a, b) => a.crawled_at < b.crawled_at ? -1 : 1);
  const categories = sorted.map((r) => r.crawled_at);
  const toData = (field) => sorted.map((r) => Number(r[field] || 0));
  return {
    categories,
    series: [
      { name: '商业游戏-Players', group: 'peak_players', yAxisIndex: 0, data: toData('biz_online_players') },
      { name: '独立小游戏-Players', group: 'peak_players', yAxisIndex: 0, data: toData('mini_game_online_players') },
      { name: 'Maker小游戏-Players', group: 'peak_players', yAxisIndex: 0, data: toData('tmk_online_players') },
      { name: '商业游戏-Cnt', group: 'game_cnt', yAxisIndex: 1, data: toData('biz_game_cnt') },
      { name: '独立小游戏-Cnt', group: 'game_cnt', yAxisIndex: 1, data: toData('mini_game_cnt') },
      { name: 'Maker小游戏-Cnt', group: 'game_cnt', yAxisIndex: 1, data: toData('tmk_game_cnt') },
    ],
  };
}

/** TapPC热玩游戏榜在线人数历史统计（历史峰值最高/最低/均值，无数据返回 null） */
export function transformOnlinePlayersStats(rows) {
  if (!rows || !rows.length) return null;
  const r = rows[0];
  const maxOnlinePlayers = r.max_online_players != null ? Number(r.max_online_players) : null;
  const minOnlinePlayers = r.min_online_players != null ? Number(r.min_online_players) : null;
  const avgOnlinePlayers = r.avg_online_players != null ? Number(r.avg_online_players) : null;
  if (maxOnlinePlayers == null || Number.isNaN(maxOnlinePlayers)) return null;
  return {
    maxOnlinePlayers,
    minOnlinePlayers,
    avgOnlinePlayers,
  };
}

/** TapPC在线玩家分布桶定义（顺序即展示顺序，ref 为 enableShades 的参考值） */
export const ONLINE_PLAYERS_BUCKETS = [
  { label: '在线人数[1-99]', color: '#D8CFC0', ref: 50 },
  { label: '在线人数[=100]', color: '#C9B79C', ref: 100 },
  { label: '在线人数[100-500]', color: '#C4A4A4', ref: 300 },
  { label: '在线人数[500-1000]', color: '#B9A2AE', ref: 750 },
  { label: '在线人数[1000-5000]', color: '#8FA3B0', ref: 3000 },
  { label: '在线人数[5000-10000]', color: '#6B7C8C', ref: 7500 },
  { label: '在线人数[10000+]', color: '#5C6B7A', ref: 10000 },
];

/** 按在线人数映射到桶标签（与第一层 SQL 的 CASE 一致） */
function bucketLabelFor(v) {
  if (v < 100) return '在线人数[1-99]';
  if (v === 100) return '在线人数[=100]';
  if (v <= 500) return '在线人数[100-500]';
  if (v <= 1000) return '在线人数[500-1000]';
  if (v <= 5000) return '在线人数[1000-5000]';
  if (v <= 10000) return '在线人数[5000-10000]';
  return '在线人数[10000+]';
}

/** TapPC在线玩家分布第一层（大类，带 drilldown id 和颜色） */
export function transformOnlinePlayersSource(rows) {
  if (!rows || !rows.length) return { data: [], colors: [] };
  const byLabel = {};
  rows.forEach((r) => { byLabel[r.player_bucket] = Number(r.online_players || 0); });
  const data = [];
  const colors = [];
  ONLINE_PLAYERS_BUCKETS.forEach((b) => {
    if (byLabel[b.label] != null) {
      data.push({ x: b.label, y: byLabel[b.label], drilldown: b.label });
      colors.push(b.color);
    }
  });
  return { data, colors };
}

/** TapPC在线玩家分布第二层（具体游戏，按桶分组） */
export function transformOnlinePlayersSourceGames(rows) {
  const buckets = {};
  (rows || []).forEach((r) => {
    const label = bucketLabelFor(Number(r.online_players || 0));
    if (!buckets[label]) buckets[label] = [];
    buckets[label].push({
      x: r.app_name != null ? String(r.app_name) : '未知',
      y: Number(r.online_players || 0),
    });
  });
  return buckets;
}

/** TapPC来源色板（顺序对应 pc_played / pc_emulator_played / app_hot_creative） */
/** TapPC来源配色（取自 AD_MATERIAL_COLORS 色库） */
const PC_SOURCE_COLORS = ['#5C6B7A', '#8A8F6B', '#B08B8B'];

/** TapPC来源定义（明细表 distribution_type 0/1/2，固定顺序与下钻 id） */
const PC_SOURCE_TYPES = [
  { type: '0', label: GAME_TYPE_META[0].label },
  { type: '1', label: GAME_TYPE_META[1].label },
  { type: '2', label: GAME_TYPE_META[2].label },
];

/** TapPC在线峰值来源在线人数第一层（下钻入口，按来源在线人数） */
export function transformPcOnlinePeakSource(rows) {
  if (!rows || !rows.length) return { data: [], colors: [] };
  const byType = {};
  rows.forEach((r) => {
    byType[String(r.distribution_type)] = Number(r.online_players || 0);
  });
  const data = [];
  const colors = [];
  PC_SOURCE_TYPES.forEach((t, idx) => {
    const value = byType[t.type];
    if (value == null) return;
    data.push({ x: t.label, y: value, drilldown: t.type });
    colors.push(PC_SOURCE_COLORS[idx]);
  });
  return { data, colors };
}

/** TapPC 峰值在线 KPI 字段定义（顺序即展示顺序） */
const PC_ONLINE_KPI_FIELDS = [
  { key: 'online', label: '最高在线人数' },
  { key: 'biz', label: '商业游戏最高在线人数' },
  { key: 'mini', label: '独立小游戏最高在线人数' },
  { key: 'tmk', label: 'Maker小游戏最高在线人数' },
];

/** TapPC峰值在线 KPI（各指标的最大值及其发生的时间节点） */
export function transformPcOnlinePeakKpis(rows) {
  const byKey = {};
  (rows || []).forEach((r) => {
    byKey[r.k] = { value: r.v == null ? null : Number(r.v), at: r.at || null };
  });
  return PC_ONLINE_KPI_FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
    value: byKey[f.key] ? byKey[f.key].value : null,
    at: byKey[f.key] ? byKey[f.key].at : null,
  }));
}

/** TapPC在线人数Top20游戏列表（最新统计窗口，list_type_rk<=20，按在线人数降序） */
export function transformPcOnlineTop80List(rows) {
  if (!rows || !rows.length) return { rows: [] };
  return {
    rows: rows.map((r) => ({
      appId: r.app_id,
      appName: r.app_name != null ? String(r.app_name) : null,
      icon: r.icon || '',
      tag1: r.tag_1,
      tag2: r.tag_2,
      tag3: r.tag_3,
      distributionType: r.distribution_type,
      onlinePlayers: Number(r.online_players || 0),
    })),
  };
}

/** TapPC在线人数Top80游戏最近24小时趋势（按 app_id 分组，输出共享时间轴 + 各 app 的时序） */
export function transformPcOnlineTop80Trend(rows) {
  if (!rows || !rows.length) return { labels: [], byKey: {} };
  const labelSet = new Set();
  const byKey = {};
  rows.forEach((r) => {
    const key = String(r.app_id);
    labelSet.add(r.crawled_at);
    if (!byKey[key]) byKey[key] = {};
    byKey[key][r.crawled_at] = Number(r.online_players || 0);
  });
  return { labels: [...labelSet].sort(), byKey };
}
