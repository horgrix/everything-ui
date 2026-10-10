/** 热门游戏TopN下载趋势（聚合堆叠柱状） */
export function transformAggregate(rows) {
  if (!rows || !rows.length) return { series: [], categories: [] };
  const sorted = [...rows].sort((a, b) => a.crawled_at < b.crawled_at ? -1 : 1);
  const categories = sorted.map((r) => r.crawled_at);
  return {
    categories,
    series: [
      { name: 'APP下载数', color: '#2ec4b6', data: sorted.map((r) => Number(r.app_download_count || 0)) },
      { name: 'PC端下载数', color: '#4361ee', data: sorted.map((r) => Number(r.pc_download_count || 0)) },
    ],
  };
}

/** 游戏详情趋势（三条折线：总下载数实线 + PC/移动虚线） */
export function transformDetail(rows) {
  if (!rows || !rows.length) return { series: [], categories: [], appName: null };
  const sorted = [...rows].sort((a, b) => a.crawled_at < b.crawled_at ? -1 : 1);
  const categories = sorted.map((r) => r.crawled_at);
  const toData = (field) => sorted.map((r) => Number(r[field] || 0));
  return {
    appName: null,
    categories,
    series: [
      { name: 'PC下载数', data: toData('pc_download_count') },
      { name: '移动下载数', data: toData('app_download_count') },
      { name: '总下载数', data: toData('download_count') },
    ],
  };
}

/** 游戏汇总指标（总下载 / PC / 移动 / PC占比） */
export function transformKpiSnapshot(rows) {
  if (!rows || !rows.length) return null;
  const r = rows[0];
  const totalDownload = Number(r.download_count || 0);
  const pc = Number(r.pc_download_count || 0);
  const mobile = Number(r.app_download_count || 0);
  return {
    totalDownload,
    pcDownload: pc,
    mobileDownload: mobile,
    pcRatio: totalDownload > 0 ? parseFloat(((pc / totalDownload) * 100).toFixed(2)) : null,
  };
}

/** 热门游戏TopN下载日趋势（总下载数实线 + 6 条拆分虚线） */
export function transformDailyTrend(rows) {
  if (!rows || !rows.length) return { series: [], categories: [] };
  const sorted = [...rows].sort((a, b) => a.crawled_at < b.crawled_at ? -1 : 1);
  const categories = sorted.map((r) => r.crawled_at);
  const toData = (field) => sorted.map((r) => Number(r[field] || 0));
  return {
    categories,
    series: [
      { name: '总下载数', data: toData('download_count') },
      { name: 'PC端下载数', data: toData('pc_download_count') },
      { name: 'APP下载数', data: toData('app_download_count') },
      { name: '非AI游戏下载数', data: toData('none_ai_download_count') },
      { name: 'AI游戏下载数', data: toData('ai_download_count') },
      { name: '非TapMaker游戏下载数', data: toData('ai_none_maker_download_count') },
      { name: 'TapMaker游戏下载数', data: toData('ai_maker_download_count') },
    ],
  };
}

/** 追踪的游戏分布（平台/AI/TapMaker 三个拆分视图，受窗口查询条件约束） */
export function transformDistributionByWindow(rows) {
  if (!rows || !rows.length) return { platform: null, ai: null, tapmaker: null };
  const r = rows[0];
  const trace = Number(r.trace_game_count || 0);
  const pc = Number(r.pc_game_count || 0);
  const app = Number(r.app_game_count || 0);
  const noneAi = Number(r.none_ai_game_count || 0);
  const ai = Number(r.ai_game_count || 0);
  const aiNoneMaker = Number(r.ai_none_maker_game_count || 0);
  const aiMaker = Number(r.ai_maker_game_count || 0);
  return {
    platform: { series: [pc, app], labels: ['PC游戏数', 'APP游戏数'], totalValue: trace, totalLabel: '总游戏数' },
    ai: { series: [noneAi, ai], labels: ['非AI游戏数', 'AI游戏数'], totalValue: trace, totalLabel: '总游戏数' },
    tapmaker: { series: [aiNoneMaker, aiMaker], labels: ['非TapMaker游戏下载数', 'TapMaker游戏下载数'], totalValue: ai, totalLabel: 'AI游戏数' },
  };
}

/** 热门游戏TopN下载月趋势（平台/AI/TapMaker 三个拆分视图） */
export function transformMonthlyBreakdown(rows) {
  if (!rows || !rows.length) return { categories: [], platform: [], ai: [], tapmaker: [] };
  const sorted = [...rows].sort((a, b) => a.crawled_at < b.crawled_at ? -1 : 1);
  const categories = sorted.map((r) => r.crawled_at);
  return {
    categories,
    platform: [
      { name: 'APP下载数', color: '#2ec4b6', data: sorted.map((r) => Number(r.app_download_count || 0)) },
      { name: 'PC端下载数', color: '#4361ee', data: sorted.map((r) => Number(r.pc_download_count || 0)) },
    ],
    ai: [
      { name: '非AI游戏下载数', color: '#2ec4b6', data: sorted.map((r) => Number(r.none_ai_download_count || 0)) },
      { name: 'AI游戏下载数', color: '#f77f00', data: sorted.map((r) => Number(r.ai_download_count || 0)) },
    ],
    tapmaker: [
      { name: '非TapMaker游戏下载数', color: '#2ec4b6', data: sorted.map((r) => Number(r.ai_none_maker_download_count || 0)) },
      { name: 'TapMaker游戏下载数', color: '#9b5de5', data: sorted.map((r) => Number(r.ai_maker_download_count || 0)) },
    ],
  };
}

/** 下载Top25明细列表（受窗口查询条件约束） */
export function transformTop25Detail(rows) {
  if (!rows || !rows.length) return { rows: [] };
  return {
    rows: rows.map((r) => ({
      appId: r.app_id,
      appName: r.app_name != null ? r.app_name : null,
      downloadCount: r.download_count != null ? Number(r.download_count) : null,
      crawledAt: r.crawled_at,
    })),
  };
}

/** 游戏名称映射（app_id -> app_name） */
export function transformGameNameMap(rows) {
  const map = {};
  (rows || []).forEach((r) => {
    if (r.app_id != null) map[String(r.app_id)] = r.app_name;
  });
  return map;
}

/** TapPC热玩游戏榜在线人数趋势（分组堆叠柱状：峰值玩家数 + 统计游戏数双组双轴） */
export function transformOnlinePlayersTrend(rows) {
  if (!rows || !rows.length) return { series: [], categories: [] };
  const sorted = [...rows].sort((a, b) => a.crawled_at < b.crawled_at ? -1 : 1);
  const categories = sorted.map((r) => r.crawled_at);
  const toData = (field) => sorted.map((r) => Number(r[field] || 0));
  return {
    categories,
    series: [
      { name: 'TapPC峰值在线玩家数', group: 'peak_players', yAxisIndex: 0, data: toData('pc_online_players') },
      { name: 'TapPC模拟器峰值在线玩家数', group: 'peak_players', yAxisIndex: 0, data: toData('pc_emulator_online_players') },
      { name: 'TapPC小游戏C峰值在线玩家数', group: 'peak_players', yAxisIndex: 0, data: toData('creative_non_online_players') },
      { name: 'TapPC小游戏M峰值在线玩家数', group: 'peak_players', yAxisIndex: 0, data: toData('creative_mk_online_players') },
      { name: 'TapPC统计游戏数', group: 'game_cnt', yAxisIndex: 1, data: toData('stat_pc_game_cnt') },
      { name: 'TapPC模拟器统计游戏数', group: 'game_cnt', yAxisIndex: 1, data: toData('stat_pc_emulator_game_cnt') },
      { name: 'TapPC小游戏C统计游戏数', group: 'game_cnt', yAxisIndex: 1, data: toData('stat_creative_non_game_cnt') },
      { name: 'TapPC小游戏M统计游戏数', group: 'game_cnt', yAxisIndex: 1, data: toData('stat_creative_mk_game_cnt') },
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

/** 最新数据时间（字符串，无数据时为 null） */
export function transformNewestDate(rows) {
  if (!rows || !rows.length) return null;
  return rows[0].newest_datestr;
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
export const PC_SOURCE_COLORS = ['#5C6B7A', '#8A8F6B', '#B08B8B'];

/** TapPC来源定义（固定顺序、标签、下钻 id） */
export const PC_SOURCE_TYPES = [
  { type: 'pc_played', label: 'TapPC游戏在线' },
  { type: 'pc_emulator_played', label: 'TapPC模拟器游戏在线' },
  { type: 'app_hot_creative', label: 'TapPC小游戏在线' },
];

/** TapPC在线峰值来源在线人数第一层（下钻入口，按来源在线人数） */
export function transformPcOnlinePeakSource(rows) {
  if (!rows || !rows.length) return { data: [], colors: [] };
  const r = rows[0];
  const values = {
    pc_played: Number(r.pc_online_players || 0),
    pc_emulator_played: Number(r.pc_emulator_online_players || 0),
    app_hot_creative: Number(r.creative_online_players || 0),
  };
  const data = [];
  const colors = [];
  PC_SOURCE_TYPES.forEach((t, idx) => {
    data.push({ x: t.label, y: values[t.type], drilldown: t.type });
    colors.push(PC_SOURCE_COLORS[idx]);
  });
  return { data, colors };
}

/** TapPC在线峰值来源第二层（按来源分组的具体游戏明细，按在线人数降序） */
export function transformPcOnlinePeakRank(rows) {
  const byType = {
    pc_played: [],
    pc_emulator_played: [],
    app_hot_creative: [],
  };
  (rows || []).forEach((r) => {
    const bucket = byType[r.list_type];
    if (bucket) {
      bucket.push({
        x: r.app_name != null ? String(r.app_name) : '未知',
        y: Number(r.online_players || 0),
      });
    }
  });
  return byType;
}

/** TapPC在线人数总量（最新一行；总在线人数 + 各来源在线人数，用于计算贡献度） */
export function transformPcOnlinePeakTotals(rows) {
  if (!rows || !rows.length) return null;
  const r = rows[0];
  return {
    total: Number(r.online_players || 0),
    byType: {
      pc_played: Number(r.pc_online_players || 0),
      pc_emulator_played: Number(r.pc_emulator_online_players || 0),
      app_hot_creative: Number(r.creative_online_players || 0),
    },
  };
}

/** TapPC在线人数Top20游戏列表（最新统计窗口，list_type_rk<=20，按在线人数降序） */
export function transformPcOnlineTop20List(rows) {
  if (!rows || !rows.length) return { rows: [] };
  return {
    rows: rows.map((r) => ({
      appId: r.app_id,
      appName: r.app_name != null ? String(r.app_name) : null,
      tag1: r.tag_1,
      tag2: r.tag_2,
      tag3: r.tag_3,
      listType: r.list_type,
      distributionType: r.distribution_type,
      onlinePlayers: Number(r.online_players || 0),
      listTypeRk: r.list_type_rk,
    })),
  };
}

/** TapPC在线人数Top20游戏最近24小时趋势（按 app_id+list_type 分组，输出共享时间轴 + 各 app 的时序） */
export function transformPcOnlineTop20Trend(rows) {
  if (!rows || !rows.length) return { labels: [], byKey: {} };
  const labelSet = new Set();
  const byKey = {};
  rows.forEach((r) => {
    const key = `${r.app_id}::${r.list_type}`;
    labelSet.add(r.crawled_at);
    if (!byKey[key]) byKey[key] = {};
    byKey[key][r.crawled_at] = Number(r.online_players || 0);
  });
  return { labels: [...labelSet].sort(), byKey };
}

/** TapPC广告每日新发现广告位统计（热力图：行=position，列=crawled_at，值=广告加载率） */
export function transformAdNewPositionStats(rows) {
  if (!rows || !rows.length) return { series: [], categories: [] };
  const categories = [...new Set(rows.map((r) => r.crawled_at))].sort();
  const positions = [...new Set(rows.map((r) => String(r.position)))].sort((a, b) => Number(a) - Number(b));
  const byPos = {};
  rows.forEach((r) => {
    const pos = String(r.position);
    if (!byPos[pos]) byPos[pos] = {};
    byPos[pos][r.crawled_at] = Number(r.ad_loading_rate);
  });
  const series = positions.map((pos) => ({
    name: `位置${pos}`,
    data: categories.map((c) => ({ x: c, y: byPos[pos][c] ?? null })),
  }));
  return { series, categories };
}

/** TapApp首页找游戏广告位统计（合并热力图：行=position，列=ios/android，值=广告加载率） */
export function transformTapAppAdNewPositionStats(rows) {
  const categories = ['ios', 'android'];
  if (!rows || !rows.length) return { series: [], categories };
  const positions = [...new Set(rows.map((r) => String(r.position)))].sort((a, b) => Number(a) - Number(b));
  const byPos = {};
  rows.forEach((r) => {
    const pos = String(r.position);
    if (!byPos[pos]) byPos[pos] = {};
    byPos[pos][r.platform] = Number(r.ad_loading_rate);
  });
  const series = positions.map((pos) => ({
    name: `位置${pos}`,
    data: categories.map((c) => ({ x: c, y: byPos[pos]?.[c] ?? null })),
  }));
  return { series, categories };
}

/** TapPC广告投放素材分布第一层（大类tag，带drilldown，按加载率降序） */
export function transformAdMaterialTags(rows) {
  if (!rows || !rows.length) return { data: [], tags: [] };
  const sorted = [...rows].sort((a, b) => Number(b.ad_loading_rate || 0) - Number(a.ad_loading_rate || 0));
  const tags = [];
  const data = [];
  sorted.forEach((r) => {
    const rate = Number(r.ad_loading_rate || 0);
    tags.push(r.tag);
    data.push({ x: r.tag, y: rate, drilldown: r.tag });
  });
  return { data, tags };
}

/** TapPC广告投放素材分布第二层（具体游戏，按tag分组，记录每组最大加载次数） */
export function transformAdMaterialGames(rows) {
  const byTag = {};
  const maxByTag = {};
  (rows || []).forEach((r) => {
    const tag = r.tag;
    if (!byTag[tag]) byTag[tag] = [];
    const cnt = Number(r.loaded_cnt || 0);
    byTag[tag].push({
      x: r.app_name != null ? String(r.app_name) : String(r.app_id),
      y: cnt,
    });
    maxByTag[tag] = Math.max(maxByTag[tag] || 0, cnt);
  });
  return { byTag, maxByTag };
}

/** TapPC广告总曝光/总广告次数 */
export function transformAdTotalStats(rows) {
  if (!rows || !rows.length) return null;
  const r = rows[0];
  return {
    totalShowCnt: Number(r.total_show_cnt || 0),
    totalAdCnt: Number(r.total_ad_cnt || 0),
  };
}

/** TapPC广告游戏列表（含各项百分比，百分比保留2位小数） */
export function transformAdGameList(rows, totalStats) {
  if (!rows || !rows.length) return { rows: [] };
  const totalShow = totalStats?.totalShowCnt || 0;
  const totalAd = totalStats?.totalAdCnt || 0;
  const toPct = (v) => (v == null ? null : parseFloat(v.toFixed(2)));
  const list = rows.map((r) => {
    const showCnt = Number(r.show_cnt || 0);
    const adCnt = Number(r.ad_cnt || 0);
    return {
      appId: r.app_id,
      appName: r.app_name != null ? String(r.app_name) : null,
      tag1: r.tag_1 != null ? String(r.tag_1) : null,
      tag2: r.tag_2 != null ? String(r.tag_2) : null,
      tag3: r.tag_3 != null ? String(r.tag_3) : null,
      distributionType: r.distribution_type != null ? Number(r.distribution_type) : null,
      showCnt,
      iosShowCnt: r.ios_show_cnt != null ? Number(r.ios_show_cnt) : null,
      androidShowCnt: r.android_show_cnt != null ? Number(r.android_show_cnt) : null,
      adCnt,
      iosAdCnt: r.ios_ad_cnt != null ? Number(r.ios_ad_cnt) : null,
      androidAdCnt: r.android_ad_cnt != null ? Number(r.android_ad_cnt) : null,
      adDeliveryRate: showCnt > 0 ? toPct((adCnt / showCnt) * 100) : null,
      adContributionRate: totalAd > 0 ? toPct((adCnt / totalAd) * 100) : null,
      adLoadingRate: totalShow > 0 ? toPct((adCnt / totalShow) * 100) : null,
    };
  });
  return { rows: list };
}

/** TapApp首页找游戏广告每日投放趋势（app_id -> 每日投放次数，共用日期横轴） */
export function transformTapAppAdGameDailyTrend(rows) {
  if (!rows || !rows.length) return { byApp: {}, days: [] };
  const byApp = {};
  const daySet = new Set();
  rows.forEach((r) => {
    const appId = r.app_id;
    if (!byApp[appId]) byApp[appId] = {};
    byApp[appId][r.day] = Number(r.ad_cnt || 0);
    daySet.add(r.day);
  });
  return { byApp, days: [...daySet].sort() };
}

/** TapApp首页找游戏广告总计（overview总览表汇总） */
export function transformTapAppAdOverviewStats(rows) {
  if (!rows || !rows.length) return null;
  const r = rows[0];
  return {
    totalViews: Number(r.total_views || 0),
    iosViews: Number(r.ios_views || 0),
    androidViews: Number(r.android_views || 0),
    adViews: Number(r.ad_views || 0),
    iosAdViews: Number(r.ios_ad_views || 0),
    androidAdViews: Number(r.android_ad_views || 0),
  };
}

/** TapApp首页找游戏广告每日总投放趋势（overview总览表按日） */
export function transformTapAppAdOverviewDailyTrend(rows) {
  if (!rows || !rows.length) return { days: [], adCnts: [] };
  const sorted = [...rows].sort((a, b) => (a.day < b.day ? -1 : 1));
  return {
    days: sorted.map((r) => r.day),
    adCnts: sorted.map((r) => Number(r.ad_cnt || 0)),
  };
}

/** TapApp首页找游戏广告加载率趋势（最近24小时，整体/iOS/Android 三条折线，值=百分比，分母0为 null） */
export function transformTapAppAdOverviewHourlyTrend(rows) {
  if (!rows || !rows.length) return { categories: [], series: [] };
  const sorted = [...rows].sort((a, b) => (a.crawled_at < b.crawled_at ? -1 : 1));
  const categories = sorted.map((r) => r.crawled_at);
  const rate = (ad, views) => {
    const v = Number(views);
    if (!v) return null;
    return parseFloat(((Number(ad) / v) * 100).toFixed(2));
  };
  return {
    categories,
    series: [
      { name: '整体', data: sorted.map((r) => rate(r.ad_views, r.total_views)) },
      { name: 'iOS', data: sorted.map((r) => rate(r.ios_ad_views, r.ios_views)) },
      { name: 'Android', data: sorted.map((r) => rate(r.android_ad_views, r.android_views)) },
    ],
  };
}

/** TapApp首页找游戏广告投放排名（按 app_id 合并本日/本周/本月排名） */
export function transformTapAppAdRank(rows) {
  const byApp = {};
  (rows || []).forEach((r) => {
    const appId = r.app_id;
    if (!byApp[appId]) byApp[appId] = {};
    byApp[appId][r.rank_type] = Number(r.ad_views_rank);
  });
  return { byApp };
}

/** TapPC广告每日加载率趋势（柱状=曝光次数，折线=加载率） */
export function transformAdLoadingRateTrend(rows) {
  if (!rows || !rows.length) return { series: [], categories: [] };
  const sorted = [...rows].sort((a, b) => (a.crawled_at < b.crawled_at ? -1 : 1));
  const categories = sorted.map((r) => r.crawled_at);
  return {
    categories,
    series: [
      { name: '曝光次数', type: 'column', yAxisIndex: 0, data: sorted.map((r) => Number(r.show_cnt || 0)) },
      { name: '加载率', type: 'line', yAxisIndex: 1, data: sorted.map((r) => Number(r.ad_loading_rate || 0)) },
    ],
  };
}

/** TapApp搜索页广告位统计（按 source 拆分，各自 position×平台 热力图，值=加载率） */
export function transformTapAppSearchPositionStats(rows) {
  const empty = { discovery: { series: [], categories: [] }, hot_search: { series: [], categories: [] }, hot_spot: { series: [], categories: [] } };
  if (!rows || !rows.length) return empty;
  const categories = ['ios', 'android'];
  const build = (sourceRows) => {
    if (!sourceRows.length) return { series: [], categories };
    const positions = [...new Set(sourceRows.map((r) => String(r.position)))].sort((a, b) => Number(a) - Number(b));
    const byPos = {};
    sourceRows.forEach((r) => {
      const pos = String(r.position);
      if (!byPos[pos]) byPos[pos] = {};
      byPos[pos][r.platform] = Number(r.ad_loading_rate);
    });
    const series = positions.map((pos) => ({
      name: `位置${pos}`,
      data: categories.map((c) => ({ x: c, y: byPos[pos]?.[c] ?? null })),
    }));
    return { series, categories };
  };
  return {
    discovery: build(rows.filter((r) => r.source === 'discovery')),
    hot_search: build(rows.filter((r) => r.source === 'hot_search')),
    hot_spot: build(rows.filter((r) => r.source === 'hot_spot')),
  };
}

/** TapApp搜索页广告每日加载率趋势（柱状=曝光次数，折线=加载率） */
export function transformTapAppSearchLoadingRateTrend(rows) {
  if (!rows || !rows.length) return { series: [], categories: [] };
  const sorted = [...rows].sort((a, b) => (a.crawled_at < b.crawled_at ? -1 : 1));
  const categories = sorted.map((r) => r.crawled_at);
  return {
    categories,
    series: [
      { name: '曝光次数', type: 'column', yAxisIndex: 0, data: sorted.map((r) => Number(r.show_cnt || 0)) },
      { name: '加载率', type: 'line', yAxisIndex: 1, data: sorted.map((r) => Number(r.ad_loading_rate || 0)) },
    ],
  };
}

/** TapApp搜索页关键词广告统计（按 source 拆分，输出表格行数据，按广告投放次数降序） */
export function transformTapAppSearchKeywordStats(rows) {
  const empty = { discovery: { rows: [] }, hot_search: { rows: [] }, hot_spot: { rows: [] } };
  if (!rows || !rows.length) return empty;
  const toPct = (v) => (v == null ? null : parseFloat(v.toFixed(2)));
  const build = (sourceRows) => {
    if (!sourceRows.length) return { rows: [] };
    // UNION 会带出所有 keyword（含某来源无数据的），过滤掉 show_cnt=0 且 ad_cnt=0 的无效行
    const validRows = sourceRows.filter((r) => !(Number(r.show_cnt || 0) === 0 && Number(r.ad_cnt || 0) === 0));
    if (!validRows.length) return { rows: [] };
    const totalShow = validRows.reduce((s, r) => s + Number(r.show_cnt || 0), 0);
    const totalAd = validRows.reduce((s, r) => s + Number(r.ad_cnt || 0), 0);
    const list = validRows.map((r) => {
      const showCnt = Number(r.show_cnt || 0);
      const adCnt = Number(r.ad_cnt || 0);
      return {
        keyword: r.keyword,
        showCnt,
        iosShowCnt: r.ios_show_cnt != null ? Number(r.ios_show_cnt) : 0,
        androidShowCnt: r.android_show_cnt != null ? Number(r.android_show_cnt) : 0,
        adCnt,
        iosAdCnt: r.ios_ad_cnt != null ? Number(r.ios_ad_cnt) : 0,
        androidAdCnt: r.android_ad_cnt != null ? Number(r.android_ad_cnt) : 0,
        adDeliveryRate: showCnt > 0 ? toPct((adCnt / showCnt) * 100) : null,
        adContributionRate: totalAd > 0 ? toPct((adCnt / totalAd) * 100) : null,
        adLoadingRate: totalShow > 0 ? toPct((adCnt / totalShow) * 100) : null,
      };
    }).sort((a, b) => b.adCnt - a.adCnt).slice(0, 100);
    return { rows: list };
  };
  return {
    discovery: build(rows.filter((r) => r.source === 'discovery')),
    hot_search: build(rows.filter((r) => r.source === 'hot_search')),
    hot_spot: build(rows.filter((r) => r.source === 'hot_spot')),
  };
}

/** TapApp搜索页关键词每日投放趋势（按 source 拆分：keyword -> 每日投放次数） */
export function transformTapAppSearchKeywordDailyTrend(rows) {
  const empty = { discovery: { byKeyword: {}, days: [] }, hot_search: { byKeyword: {}, days: [] }, hot_spot: { byKeyword: {}, days: [] } };
  if (!rows || !rows.length) return empty;
  const build = (sourceRows) => {
    const byKeyword = {};
    const daySet = new Set();
    sourceRows.forEach((r) => {
      if (!byKeyword[r.keyword]) byKeyword[r.keyword] = {};
      byKeyword[r.keyword][r.day] = Number(r.ad_cnt || 0);
      daySet.add(r.day);
    });
    return { byKeyword, days: [...daySet].sort() };
  };
  return {
    discovery: build(rows.filter((r) => r.source === 'discovery')),
    hot_search: build(rows.filter((r) => r.source === 'hot_search')),
    hot_spot: build(rows.filter((r) => r.source === 'hot_spot')),
  };
}

/** TapApp搜索页总曝光/总投放（按 source 拆分） */
export function transformTapAppSearchTotalStats(rows) {
  const empty = { discovery: null, hot_search: null, hot_spot: null };
  if (!rows || !rows.length) return empty;
  const map = {};
  rows.forEach((r) => {
    map[r.source] = {
      totalShowCnt: Number(r.total_show_cnt || 0),
      totalAdCnt: Number(r.total_ad_cnt || 0),
    };
  });
  return {
    discovery: map.discovery || null,
    hot_search: map.hot_search || null,
    hot_spot: map.hot_spot || null,
  };
}

/** TapApp搜索页关键词概述（按 source 拆分，每项含分平台曝光/投放汇总，供表格总计行） */
export function transformTapAppSearchKeywordOverview(rows) {
  const empty = { discovery: null, hot_search: null, hot_spot: null };
  if (!rows || !rows.length) return empty;
  const map = {};
  rows.forEach((r) => {
    map[r.source] = {
      showCnt: Number(r.show_cnt || 0),
      iosShowCnt: Number(r.ios_show_cnt || 0),
      androidShowCnt: Number(r.android_show_cnt || 0),
      adCnt: Number(r.ad_cnt || 0),
      iosAdCnt: Number(r.ios_ad_cnt || 0),
      androidAdCnt: Number(r.android_ad_cnt || 0),
    };
  });
  return {
    discovery: map.discovery || null,
    hot_search: map.hot_search || null,
    hot_spot: map.hot_spot || null,
  };
}

/** TapApp搜索页关键词概述每日投放趋势（按 source 拆分：days + adCnts，day 升序） */
export function transformTapAppSearchKeywordOverviewDailyTrend(rows) {
  const empty = { discovery: { days: [], adCnts: [] }, hot_search: { days: [], adCnts: [] }, hot_spot: { days: [], adCnts: [] } };
  if (!rows || !rows.length) return empty;
  const build = (sourceRows) => {
    const sorted = [...sourceRows].sort((a, b) => (a.day < b.day ? -1 : 1));
    return {
      days: sorted.map((r) => r.day),
      adCnts: sorted.map((r) => Number(r.ad_cnt || 0)),
    };
  };
  return {
    discovery: build(rows.filter((r) => r.source === 'discovery')),
    hot_search: build(rows.filter((r) => r.source === 'hot_search')),
    hot_spot: build(rows.filter((r) => r.source === 'hot_spot')),
  };
}

/** TapApp搜索页关键词投放排名（按 source:keyword 合并本日/本周/本月排名；kv_source discover→discovery） */
export function transformTapAppSearchKeywordRank(rows) {
  const byKey = {};
  (rows || []).forEach((r) => {
    const src = r.kv_source === 'discover' ? 'discovery' : r.kv_source;
    const key = `${src}:${r.keyword}`;
    if (!byKey[key]) byKey[key] = {};
    byKey[key][r.rank_type] = Number(r.ad_views_rank);
  });
  return { byKey };
}
