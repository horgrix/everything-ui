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
  if (!rows || !rows.length) return { series: [], appName: null };
  const sorted = [...rows].sort((a, b) => a.crawled_at < b.crawled_at ? -1 : 1);
  const toData = (field) => sorted.map((r) => ({ x: r.crawled_at, y: Number(r[field] || 0) }));
  return {
    appName: null,
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
  if (!rows || !rows.length) return { series: [] };
  const sorted = [...rows].sort((a, b) => a.crawled_at < b.crawled_at ? -1 : 1);
  const toData = (field) => sorted.map((r) => ({ x: r.crawled_at, y: Number(r[field] || 0) }));
  return {
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
