/**
 * 下载统计数据转换（趋势 / 分布 / Top 明细）
 */

/** 热门游戏TopN下载趋势（聚合堆叠柱状） */
export function transformAggregate(rows) {
  if (!rows || !rows.length) return { series: [], categories: [] };
  const sorted = [...rows].sort((a, b) => a.crawled_at < b.crawled_at ? -1 : 1);
  return {
    categories: sorted.map((r) => r.crawled_at),
    series: [
      { name: '商业游戏', color: '#8FA3B0', data: sorted.map((r) => Number(r.biz_download_count || 0)) },
      { name: '独立小游戏', color: '#B08B8B', data: sorted.map((r) => Number(r.mini_download_count || 0)) },
      { name: 'Maker小游戏', color: '#9B93A8', data: sorted.map((r) => Number(r.tmk_download_count || 0)) },
    ],
  };
}

/** 今日实时汇总（SQLite 小时表当天聚合）：返回周几索引 + APP/PC 下载数，供日趋势图覆盖「今天」那一点 */
export function transformTodayRealtime(rows, ref) {
  const base = ref instanceof Date ? ref : new Date();
  const r = (rows || [])[0];
  if (!r || r.latest_hour == null) return null;
  const today = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const mondayOffset = (today.getDay() + 6) % 7;
  return {
    weekdayIdx: mondayOffset,
    latestHour: String(r.latest_hour),
    app: Number(r.app_download_count || 0),
    pc: Number(r.pc_download_count || 0),
    nonMaker: Number(r.mini_download_count || 0),
    maker: Number(r.tmk_download_count || 0),
  };
}

/**
 * 昨日 / 上周同日汇总 → { yesterday: {...}, lastWeek: {...} }
 * 每项：app / pc / mini / miniTotal（小游戏 = 独立 + Maker）/ tmk / total（全平台 = app + pc）
 */
export function transformDaySummary(rows, ref) {
  const base = ref instanceof Date ? ref : new Date();
  const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const dayOffset = (n) => fmt(new Date(base.getFullYear(), base.getMonth(), base.getDate() - n));
  const wanted = { [dayOffset(1)]: 'yesterday', [dayOffset(7)]: 'lastWeek' };

  const empty = { app: null, pc: null, mini: null, tmk: null, miniTotal: null, total: null };
  const result = { yesterday: { date: dayOffset(1), ...empty }, lastWeek: { date: dayOffset(7), ...empty } };

  (rows || []).forEach((r) => {
    const key = wanted[String(r.crawled_at).slice(0, 10)];
    if (!key) return;
    const app = Number(r.app_download_count || 0);
    const pc = Number(r.pc_download_count || 0);
    const mini = Number(r.mini_download_count || 0);
    const tmk = Number(r.tmk_download_count || 0);
    result[key] = { date: String(r.crawled_at).slice(0, 10), app, pc, mini, tmk, miniTotal: mini + tmk, total: app + pc };
  });
  return result;
}

/** 追踪的游戏分布（平台/AI/TapMaker 三个拆分视图，受窗口查询条件约束） */
export function transformDistributionByWindow(rows) {
  if (!rows || !rows.length) return { platform: null, ai: null, tapmaker: null };
  const r = rows[0];
  const trace = Number(r.trace_game_count || 0);
  const pc = Number(r.pc_game_count || 0);
  const app = Number(r.app_game_count || 0);
  const ai = Number(r.ai_game_count || 0);
  const aiNoneMaker = Number(r.ai_none_maker_game_count || 0);
  const aiMaker = Number(r.ai_maker_game_count || 0);
  /* 小游戏分布：distribution_type 1=独立小游戏、2=Maker小游戏，
     圆心总数取二者之和（= AI/小游戏口径 ai_game_count），出现其它类型时补「其他」扇区。 */
  const nonMakerMini = aiNoneMaker;
  const makerMini = aiMaker;
  const miniOther = Math.max(0, ai - nonMakerMini - makerMini);
  const gameTypeSeries = [nonMakerMini, makerMini];
  const gameTypeLabels = ['独立小游戏', 'Maker小游戏'];
  if (miniOther > 0) {
    gameTypeSeries.push(miniOther);
    gameTypeLabels.push('其他');
  }

  return {
    platform: { series: [pc, app], labels: ['PC游戏数', 'APP游戏数'], totalValue: trace, totalLabel: '总游戏数' },
    gameType: {
      series: gameTypeSeries,
      labels: gameTypeLabels,
      totalValue: ai,
      totalLabel: '小游戏数',
    },
    tapmaker: { series: [aiNoneMaker, aiMaker], labels: ['非TapMaker游戏下载数', 'TapMaker游戏下载数'], totalValue: ai, totalLabel: 'AI游戏数' },
  };
}

/** 下载Top25明细列表（受窗口查询条件约束） */
export function transformTop25Detail(rows) {
  if (!rows || !rows.length) return { rows: [] };
  return {
    rows: rows.map((r) => ({
      appId: r.app_id,
      // v2 小时表直接在行里带名称/图标/标签；日/月表没有这些列（走 gameMap 兜底）
      appName: r.app_name != null ? r.app_name : null,
      icon: r.icon != null ? r.icon : null,
      tags: [r.tag_1, r.tag_2, r.tag_3].filter(Boolean).map(String),
      totalDownloadCount: r.total_download_count != null ? Number(r.total_download_count) : null,
      downloadCount: r.download_count != null ? Number(r.download_count) : null,
      refer: r.refer != null ? String(r.refer) : null,
      distributionType: r.distribution_type != null ? Number(r.distribution_type) : null,
      crawledAt: r.crawled_at,
    })),
  };
}
