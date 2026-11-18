import { WEEKDAY_LABELS, splitDailyByWeek, thisMonday } from './shared';

/**
 * TapTap 广告数据转换（广告大盘 / 渠道明细 / 榜单）
 */

/**
 * 「本时段抓取到的广告」快照：按 grp（home / keyword / pc）分组，供悬停弹框里的三个表格使用。
 */
export function transformCurrentHourAdSnapshot(rows) {
  const out = { home: [], keyword: [], pc: [] };
  (rows || []).forEach((r) => {
    const bucket = out[r.grp];
    if (!bucket) return;
    bucket.push({ appId: r.app_id, appName: r.app_name || '', icon: r.icon || '', platform: r.platform || '' });
  });
  return out;
}

/**
 * 本周各渠道广告数趋势：按 app_id 生成周一→周日 7 个点（APP首页 / PC首页 / APP搜索关键词）。
 * 返回 { labels, byApp: { [appId]: { app: [], pc: [], kw: [] } } }，没有数据的日子为 null。
 */
export function transformAdGameChannelTrend(rows) {
  const monday = thisMonday();
  const dayKeys = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  });

  const byApp = {};
  (rows || []).forEach((r) => {
    const idx = dayKeys.indexOf(String(r.day || '').slice(0, 10));
    if (idx < 0) return;
    const appId = r.app_id;
    if (!byApp[appId]) {
      byApp[appId] = { app: Array(7).fill(null), pc: Array(7).fill(null), kw: Array(7).fill(null) };
    }
    byApp[appId].app[idx] = Number(r.app_home || 0);
    byApp[appId].pc[idx] = Number(r.pc_home || 0);
    byApp[appId].kw[idx] = Number(r.kw_search || 0);
  });

  return { labels: WEEKDAY_LABELS, byApp };
}

/** TapTap 广告大盘：按 app 的每日总投放趋势，按周几对齐成本周 / 上周两条 7 长度序列 */
export function transformAdGameDailyTrend(rows) {
  if (!rows || !rows.length) return { labels: WEEKDAY_LABELS, thisWeek: {}, lastWeek: {} };
  const { thisWeek, lastWeek } = splitDailyByWeek(rows, (r) => r.app_id);
  return { labels: WEEKDAY_LABELS, thisWeek, lastWeek };
}

/**
 * TapTap 广告本周游戏明细（TopN）：数字字段转 number，标签合并成数组，并算好总投放。
 * 行顺序由 SQL 保证（总投放倒序 → 总曝光倒序）。
 */
export function transformAdGameWeeklyTop(rows) {
  const num = (v) => (v === null || v === undefined ? 0 : Number(v) || 0);
  return (rows || []).map((r) => {
    const adViews = num(r.ad_views);
    const pcebidViews = num(r.pcebid_views);
    return {
      appId: r.app_id,
      appName: r.app_name,
      icon: r.icon || '',
      distributionType: r.distribution_type ?? null,
      tags: [r.tag_1, r.tag_2, r.tag_3].filter(Boolean),
      adViews,
      appAdViews: num(r.app_ad_views),
      pcAdViews: num(r.pc_ad_views),
      kwAdViews: num(r.kw_ad_views),
      pcebidViews,
      appPcebidViews: num(r.app_pcebid_views),
      pcPcebidViews: num(r.pc_pcebid_views),
      kwPcebidViews: num(r.kw_pcebid_views),
      totalPush: adViews + pcebidViews,
    };
  });
}

/** 全站周汇总 → 与游戏明细行同形状（供 DataTable totalRow 使用；无趋势，趋势在组件里合并） */
export function transformAdOverviewWeek(rows) {
  const r = (rows || [])[0];
  if (!r || r.total_push == null) return null; // overview_v5 还没数据（SUM 全为 NULL）时不显示汇总行
  const num = (v) => (v === null || v === undefined ? 0 : Number(v) || 0);
  const adViews = num(r.ad_views);
  const pcebidViews = num(r.pcebid_views);
  if (adViews + pcebidViews === 0) return null;
  return {
    appId: '-',
    appName: '汇总（全站）',
    distributionType: null,
    tags: [],
    adViews,
    appAdViews: num(r.app_ad_views),
    pcAdViews: num(r.pc_ad_views),
    kwAdViews: num(r.kw_ad_views),
    pcebidViews,
    appPcebidViews: num(r.app_pcebid_views),
    pcPcebidViews: num(r.pc_pcebid_views),
    kwPcebidViews: num(r.kw_pcebid_views),
    totalPush: num(r.total_push) || adViews + pcebidViews,
  };
}

/** 全站每日总投放趋势：本周 / 上周按周几对齐（汇总行的 sparkline 用） */
export function transformAdOverviewDailyTrend(rows) {
  const empty = new Array(7).fill(null);
  if (!rows || !rows.length) return { labels: WEEKDAY_LABELS, thisWeek: empty, lastWeek: empty };
  const { thisWeek, lastWeek } = splitDailyByWeek(rows, () => '_all');
  return {
    labels: WEEKDAY_LABELS,
    thisWeek: thisWeek._all || empty,
    lastWeek: lastWeek._all || empty,
  };
}

/** 上周投放排名 → { byAppId: { appId: rank }, count }（未命中的 app 由调用方显示「未上榜」） */
export function transformAdRankWeek(rows) {
  const byAppId = {};
  (rows || []).forEach((r) => {
    if (r.ad_rank == null) return;
    byAppId[r.app_id] = Number(r.ad_rank);
  });
  return { byAppId, count: Object.keys(byAppId).length };
}

/**
 * 上周投放排名「推算」结果 → { byAppId, count, rows }
 * byAppId 供「上周投放排名」列查名次；rows 供「上周投放 Top10」图表用（已按 SQL 顺序编号 1..N）
 */
export function transformAdRankDerivedWeek(rows) {
  const byAppId = {};
  const list = rows || [];
  list.forEach((r, i) => {
    byAppId[r.app_id] = i + 1;
  });
  return {
    byAppId,
    count: list.length,
    rows: list.map((r, i) => {
      // 与 rank 表同口径：各端广告数 = *_ad_views + *_pcebid_views
      const appAdViews = Number(r.app_ad_views) || 0;
      const pcAdViews = Number(r.pc_ad_views) || 0;
      const kvAdViews = Number(r.kv_ad_views) || 0;
      const splitSum = appAdViews + pcAdViews + kvAdViews;
      return {
        appId: r.app_id,
        appName: r.app_name || String(r.app_id),
        rank: i + 1,
        appAdViews,
        pcAdViews,
        kvAdViews,
        totalAdViews: splitSum > 0 ? splitSum : Number(r.push_cnt) || 0,
      };
    }),
  };
}

/** 广告曝光汇总行 → { appHome, appSearch, pcHome, pcSearch }（PC 搜索页未上线，恒 0） */
function exposureOf(row) {
  if (!row) return null;
  return {
    appHome: Number(row.app_home || 0),
    appSearch: Number(row.app_search || 0),
    pcHome: Number(row.pc_home || 0),
    pcSearch: 0,
    // 当日有广告曝光的 APP 款数（商业广告 + 资源互换任一 > 0）
    appCnt: Number(row.app_cnt || 0),
  };
}

/** 今日曝光（SQLite 当日累计）；当天还没有行时返回 null */
export function transformAdExposureToday(rows) {
  return exposureOf((rows || [])[0]);
}

/** 昨日 / 上周同日曝光（MySQL 日表）：{ yesterday, lastWeek } */
export function transformAdExposureHistory(rows, ref) {
  const base = ref instanceof Date ? ref : new Date();
  const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const dayOffset = (n) => fmt(new Date(base.getFullYear(), base.getMonth(), base.getDate() - n));
  const wanted = { [dayOffset(1)]: 'yesterday', [dayOffset(7)]: 'lastWeek' };
  const result = { yesterday: null, lastWeek: null };
  (rows || []).forEach((r) => {
    const key = wanted[String(r.crawled_at).slice(0, 10)];
    if (key) result[key] = exposureOf(r);
  });
  return result;
}
