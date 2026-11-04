/**
 * 仅开发环境使用的示例数据（生产构建不参与任何数据回落）。
 * 用途：后端 / 运维的静态 JSON 还没到位时，页面结构与交互可以先看、先对。
 * 数据是编的，页面上会显示「示例数据」提示，不会冒充真实数据。
 */

const days = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(2026, 9, 7 + i);
  return `${d.getMonth() + 1}/${d.getDate()}`;
});

const wave = (base, amp, seed) =>
  days.map((_, i) => Math.round(base + amp * Math.sin((i + seed) / 2.6) + ((i * seed) % 17) * amp * 0.06));

const mock = {
  'manifest.json': {
    title: '数据大盘',
    subtitle: '全站核心指标总览（示例数据）',
    updatedAt: '2026-11-05T08:10:00+08:00',
    period: '2026-11',
    blocks: [
      { id: 'core-kpi', type: 'kpi', title: '核心指标', source: 'core-kpi.json', span: 12 },
      { id: 'traffic-trend', type: 'trend', title: '站内访问趋势（近 30 天）', source: 'traffic-trend.json', span: 7, height: 320 },
      { id: 'type-share', type: 'distribution', title: '游戏题材分布', source: 'type-share.json', span: 5, height: 320 },
      { id: 'game-rank', type: 'rank', title: '热门游戏 Top 10', source: 'game-rank.json', span: 12, maxRows: 10 },
    ],
  },

  'core-kpi.json': {
    items: [
      { label: '在库游戏数', value: 12874, delta: 0.0213, deltaLabel: '较上月', hint: 'dws 全量去重 app_id' },
      { label: '本月新增', value: 316, delta: -0.0741, deltaLabel: '较上月' },
      { label: '日活用户（DAU）', value: 1842300, format: 'compact', delta: 0.0452, deltaLabel: '较上周同期' },
      { label: '广告消耗', value: 2864.5, format: 'number', unit: '万元', delta: 0.118, deltaLabel: '较上月' },
      { label: '站内 PV', value: 96420, format: 'number', delta: 0.0211, deltaLabel: '较上周同期' },
    ],
  },

  'traffic-trend.json': {
    categories: days,
    series: [
      { name: 'PV', type: 'line', data: wave(3200, 420, 3) },
      { name: 'UV', type: 'line', data: wave(960, 130, 7) },
    ],
  },

  'type-share.json': {
    labels: ['角色扮演', '策略', '模拟经营', '休闲', '卡牌', '其他'],
    values: [3120, 2480, 1930, 1720, 1480, 2144],
  },

  'game-rank.json': {
    columns: [
      { key: 'rank', label: '#', align: 'end', width: '56px' },
      { key: 'name', label: '游戏' },
      { key: 'type', label: '题材' },
      { key: 'opened', label: '本月开测', align: 'end', format: 'number' },
      { key: 'ad', label: '广告消耗（万）', align: 'end', format: 'money' },
      { key: 'delta', label: '环比', align: 'end', format: 'percent' },
    ],
    rows: [
      { rank: 1, name: '示例·星海远征', type: '角色扮演', opened: 12, ad: 486.2, delta: 0.213 },
      { rank: 2, name: '示例·归墟', type: '策略', opened: 9, ad: 421.7, delta: 0.084 },
      { rank: 3, name: '示例·小店物语', type: '模拟经营', opened: 8, ad: 388.4, delta: -0.032 },
      { rank: 4, name: '示例·雨夜列车', type: '卡牌', opened: 7, ad: 302.9, delta: 0.146 },
      { rank: 5, name: '示例·喵星防线', type: '休闲', opened: 6, ad: 268.1, delta: -0.078 },
      { rank: 6, name: '示例·长安夜行', type: '角色扮演', opened: 5, ad: 241.6, delta: 0.052 },
      { rank: 7, name: '示例·深渊回响', type: '策略', opened: 5, ad: 210.3, delta: 0.017 },
      { rank: 8, name: '示例·晨曦酒馆', type: '模拟经营', opened: 4, ad: 186.8, delta: -0.011 },
      { rank: 9, name: '示例·镜中之城', type: '卡牌', opened: 4, ad: 164.2, delta: 0.093 },
      { rank: 10, name: '示例·风筝与海', type: '休闲', opened: 3, ad: 142.5, delta: -0.046 },
    ],
  },
};

export default mock;
