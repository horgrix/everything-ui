/** 热门游戏TopN下载趋势（聚合堆叠柱状） */
export function transformAggregate(rows) {
  if (!rows || !rows.length) return { series: [], categories: [] };
  const sorted = [...rows].sort((a, b) => a.crawled_at < b.crawled_at ? -1 : 1);
  const categories = sorted.map((r) => r.crawled_at);
  return {
    categories,
    series: [
      { name: '移动端下载', color: '#2ec4b6', data: sorted.map((r) => Number(r.hits_total || 0)) },
      { name: 'PC端下载', color: '#4361ee', data: sorted.map((r) => Number(r.pc_download_count || 0)) },
    ],
  };
}

/** 游戏详情趋势（柱状 + 占比折线） */
export function transformDetail(rows) {
  if (!rows || !rows.length) return { series: [], appName: null };
  const sorted = [...rows].sort((a, b) => a.crawled_at < b.crawled_at ? -1 : 1);
  return {
    appName: sorted[0].app_name,
    series: [
      { name: '总下载数', type: 'column', yAxisIndex: 0, data: sorted.map((r) => {
        const pc = Number(r.pc_download_count || 0);
        const mobile = Number(r.hits_total || 0);
        return { x: r.crawled_at, y: pc + mobile };
      }) },
      { name: 'PC下载数占比', type: 'line', yAxisIndex: 1, data: sorted.map((r) => {
        const pc = Number(r.pc_download_count || 0);
        const mobile = Number(r.hits_total || 0);
        const total = pc + mobile;
        return { x: r.crawled_at, y: total > 0 ? parseFloat(((pc / total) * 100).toFixed(2)) : null };
      }) },
    ],
  };
}

/** 游戏指标快照（汇总增量 / 历史累计 两套共用） */
export function transformKpiSnapshot(rows) {
  if (!rows || !rows.length) return null;
  const r = rows[0];
  const pc = Number(r.pc_download_count || 0);
  const mobile = Number(r.hits_total || 0);
  const total = pc + mobile;
  return {
    pcDownload: pc,
    mobileDownload: mobile,
    pcRatio: total > 0 ? parseFloat(((pc / total) * 100).toFixed(2)) : null,
    fansCount: Number(r.fans_count || 0),
    reviewCount: Number(r.review_count || 0),
    wishCount: Number(r.wish_count || 0),
  };
}

/** 热门游戏TopN下载日趋势（三条折线） */
export function transformDailyTrend(rows) {
  if (!rows || !rows.length) return { series: [] };
  const sorted = [...rows].sort((a, b) => a.crawled_at < b.crawled_at ? -1 : 1);
  return {
    series: [
      { name: '总下载数', data: sorted.map((r) => ({ x: r.crawled_at, y: Number(r.pc_download_count || 0) + Number(r.hits_total || 0) })) },
      { name: 'PC下载数', data: sorted.map((r) => ({ x: r.crawled_at, y: Number(r.pc_download_count || 0) })) },
      { name: '创意工坊下载数', data: sorted.map((r) => ({ x: r.crawled_at, y: Number(r.ai_game_count || 0) })) },
    ],
  };
}

/** 热门游戏TopN下载月趋势（堆叠柱状） */
export function transformMonthlyTrend(rows) {
  if (!rows || !rows.length) return { series: [] };
  const sorted = [...rows].sort((a, b) => a.crawled_at < b.crawled_at ? -1 : 1);
  return {
    categories: sorted.map((r) => r.crawled_at),
    series: [
      { name: 'App下载数', color: '#2ec4b6', data: sorted.map((r) => Number(r.hits_total_val || 0)) },
      { name: '创意工坊下载数', color: '#f77f00', data: sorted.map((r) => Number(r.ai_game_count || 0)) },
      { name: 'PC下载数', color: '#4361ee', data: sorted.map((r) => Number(r.pc_download_count || 0)) },
    ],
  };
}

/** 下载Top25明细列表（含 PC占比） */
export function transformTop25(rows) {
  if (!rows || !rows.length) return { rows: [] };
  return {
    rows: rows.map((r) => {
      const pc = Number(r.pc_download_count || 0);
      const total = Number(r.download_count || 0);
      return {
        appId: r.app_id,
        appName: r.app_name,
        downloadCount: total,
        pcDownloadCount: pc,
        pcRatio: total > 0 ? parseFloat(((pc / total) * 100).toFixed(2)) : null,
        downloadGrowth: r.download_growth != null ? Number(r.download_growth) : null,
        growthRate: r.growth_rate != null ? Number(r.growth_rate) : null,
        crawledAt: r.crawled_at,
      };
    }),
  };
}

/** PC下载Top25明细列表 */
export function transformPcTop25(rows) {
  if (!rows || !rows.length) return { rows: [] };
  return {
    rows: rows.map((r) => ({
      appId: r.app_id,
      appName: r.app_name,
      downloadCount: r.pc_download_count != null ? Number(r.pc_download_count) : null,
      downloadGrowth: r.download_growth != null ? Number(r.download_growth) : null,
      growthRate: r.growth_rate != null ? Number(r.growth_rate) : null,
      crawledAt: r.crawled_at,
    })),
  };
}

/** 创意工坊下载Top25明细列表 */
export function transformCreativeTop25(rows) {
  if (!rows || !rows.length) return { rows: [] };
  return {
    rows: rows.map((r) => ({
      appId: r.app_id,
      appName: r.app_name,
      downloadCount: r.download_count != null ? Number(r.download_count) : null,
      downloadGrowth: r.download_growth != null ? Number(r.download_growth) : null,
      growthRate: r.growth_rate != null ? Number(r.growth_rate) : null,
      crawledAt: r.crawled_at,
    })),
  };
}

/** 追踪的游戏分布（环形饼图） */
export function transformDistribution(rows) {
  if (!rows || !rows.length) return { series: [], labels: [], total: null };
  const r = rows[0];
  const pc = Number(r.pc_game_count || 0);
  const app = Number(r.app_game_count || 0);
  const ai = Number(r.ai_game_count || 0);
  return {
    series: [pc, app, ai],
    labels: ['PC游戏', 'APP游戏', '创意工坊游戏'],
    total: pc + app + ai,
  };
}
