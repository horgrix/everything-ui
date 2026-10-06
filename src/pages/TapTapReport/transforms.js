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

/** TapPC热门游戏在线人数趋势（今日实线加粗 + 其余虚线） */
export function transformOnlinePlayersTrend(rows) {
  if (!rows || !rows.length) return { series: [], categories: [] };
  const sorted = [...rows].sort((a, b) => a.crawled_at < b.crawled_at ? -1 : 1);
  const categories = sorted.map((r) => r.crawled_at);
  const toData = (field) => sorted.map((r) => Number(r[field] || 0));
  return {
    categories,
    series: [
      { name: '今日', data: toData('today_total_online_players') },
      { name: '昨日', data: toData('yesterday_total_online_players') },
      { name: '7日前', data: toData('ago_7_total_online_players') },
      { name: '30日前', data: toData('ago_30_total_online_players') },
      { name: '90日前', data: toData('ago_90_total_online_players') },
      { name: '365日前', data: toData('ago_365_total_online_players') },
    ],
  };
}

/** TapPC热玩游戏榜在线人数历史统计（峰值最高/最低/均值及统计区间） */
export function transformOnlinePlayersStats(rows) {
  if (!rows || !rows.length) return null;
  const r = rows[0];
  return {
    startCrawledAt: r.start_crawled_at,
    endCrawledAt: r.end_crawled_at,
    maxOnlinePlayers: Number(r.max_online_players || 0),
    avgOnlinePlayers: Number(r.avg_online_players || 0),
    minOnlinePlayers: Number(r.min_online_players || 0),
  };
}

/** TapPC在线人数分布（按人数区间） */
export function transformOnlinePlayersDistribution(rows) {
  if (!rows || !rows.length) return { series: [], labels: [], colors: [] };
  const BUCKET_ORDER = ['1-99', '=100', '100-500', '500-1000', '1000-5000', '5000-10000', '10000+'];
  const BUCKET_COLORS = {
    '1-99': '#C0ADDB',
    '=100': '#7F94B0',
    '100-500': '#421243',
    '500-1000': '#1E5D8C',
    '1000-5000': '#F7B844',
    '5000-10000': '#3B93A5',
    '10000+': '#D43F97',
  };
  const map = {};
  rows.forEach((r) => {
    map[r.player_bucket] = Number(r.cnt || 0);
  });
  const labels = BUCKET_ORDER.filter((b) => map[b] != null);
  return {
    series: labels.map((b) => map[b]),
    labels,
    colors: labels.map((b) => BUCKET_COLORS[b]),
  };
}

/** 最新数据时间（字符串，无数据时为 null） */
export function transformNewestDate(rows) {
  if (!rows || !rows.length) return null;
  return rows[0].newest_datestr;
}

/** TapPC在线人数TopN趋势（按 app_id 分组，按最高在线人数降序） */
export function transformOnlinePlayersTopNTrend(rows) {
  if (!rows || !rows.length) return [];
  const groups = {};
  rows.forEach((r) => {
    const id = String(r.app_id);
    if (!groups[id]) {
      groups[id] = { appId: r.app_id, appName: r.app_name || null, rows: [] };
    }
    groups[id].rows.push(r);
  });
  const cards = Object.values(groups).map((g) => {
    const sorted = [...g.rows].sort((a, b) => (a.crawled_at < b.crawled_at ? -1 : 1));
    const data = sorted.map((r) => Number(r.online_players || 0));
    return {
      appId: g.appId,
      appName: g.appName,
      maxPlayers: data.length ? Math.max(...data) : 0,
      categories: sorted.map((r) => r.crawled_at),
      series: [{ name: '在线人数', data }],
    };
  });
  cards.sort((a, b) => b.maxPlayers - a.maxPlayers);
  return cards;
}

/** TapPC在线玩家分布桶定义（顺序即展示顺序，ref 为 enableShades 的参考值） */
export const ONLINE_PLAYERS_BUCKETS = [
  { label: '在线人数[1-99]', color: '#C0ADDB', ref: 50 },
  { label: '在线人数[=100]', color: '#7F94B0', ref: 100 },
  { label: '在线人数[100-500]', color: '#421243', ref: 300 },
  { label: '在线人数[500-1000]', color: '#1E5D8C', ref: 750 },
  { label: '在线人数[1000-5000]', color: '#F7B844', ref: 3000 },
  { label: '在线人数[5000-10000]', color: '#3B93A5', ref: 7500 },
  { label: '在线人数[10000+]', color: '#D43F97', ref: 10000 },
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

/** TapApp首页找游戏广告位统计（按平台拆分：ios/android 各自热力图，共用日期横轴与位置行，方便并排对照） */
export function transformTapAppAdNewPositionStats(rows) {
  const empty = { ios: { series: [], categories: [] }, android: { series: [], categories: [] } };
  if (!rows || !rows.length) return empty;
  const allCategories = [...new Set(rows.map((r) => r.crawled_at))].sort();
  const allPositions = [...new Set(rows.map((r) => String(r.position)))].sort((a, b) => Number(a) - Number(b));
  const build = (platformRows) => {
    const byPos = {};
    platformRows.forEach((r) => {
      const pos = String(r.position);
      if (!byPos[pos]) byPos[pos] = {};
      byPos[pos][r.crawled_at] = Number(r.ad_loading_rate);
    });
    const series = allPositions.map((pos) => ({
      name: `位置${pos}`,
      data: allCategories.map((c) => ({ x: c, y: byPos[pos]?.[c] ?? null })),
    }));
    return { series, categories: allCategories };
  };
  return {
    ios: build(rows.filter((r) => r.platform === 'ios')),
    android: build(rows.filter((r) => r.platform === 'android')),
  };
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

/** TapApp搜索页广告位统计（热力图：行=position，列=crawled_at，值=广告加载率） */
export function transformTapAppSearchPositionStats(rows) {
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

/** TapApp搜索页关键词广告统计（柱状图：关键词 -> 广告触发次数，按广告次数降序） */
export function transformTapAppSearchKeywordStats(rows) {
  if (!rows || !rows.length) return { categories: [], series: [] };
  const sorted = [...rows].sort((a, b) => Number(b.ad_cnt || 0) - Number(a.ad_cnt || 0));
  return {
    categories: sorted.map((r) => r.keyword),
    series: [
      { name: '广告次数', color: '#4361ee', data: sorted.map((r) => Number(r.ad_cnt || 0)) },
    ],
  };
}

/** TapApp搜索页广告游戏列表（app_id -> 广告次数） */
export function transformTapAppSearchGameList(rows) {
  if (!rows || !rows.length) return { rows: [] };
  return {
    rows: rows.map((r) => ({
      appId: r.app_id,
      adCnt: Number(r.ad_cnt || 0),
    })),
  };
}

/** TopN游戏占比（按排名分桶，柱状+占比折线混合图，排除 Top100+） */
export function transformTopNProportion(rows) {
  if (!rows || !rows.length) return { categories: [], series: [] };
  const map = {};
  rows.forEach((r) => {
    map[r.bucket] = Number(r.online_players || 0);
  });
  const total = map['Top100+'] || 0;
  const buckets = ['Top5', 'Top10', 'Top20', 'Top50', 'Top100'];
  return {
    categories: buckets,
    series: [
      { name: '在线人数', type: 'column', yAxisIndex: 0, data: buckets.map((b) => map[b] || 0) },
      { name: '占比', type: 'line', yAxisIndex: 1, data: buckets.map((b) => (total > 0 ? parseFloat(((map[b] / total) * 100).toFixed(2)) : null)) },
    ],
  };
}
