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
 * 广告明细行（今日广告曝光明细 / 历史上的本周 TopN 同结构）：
 * 数字字段转 number，标签合并成数组，并算好总投放。行顺序由 SQL 保证。
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

/**
 * 今日逐小时三渠道趋势 → { labels, byApp: { [appId]: { app: [], pc: [], kw: [] } } }
 * labels 为 00~当前小时（当前小时之后没有数据，不补点）；某小时没有命中记为 0。
 */
export function transformAdTodayHourlyTrend(rows, ref) {
  const base = ref instanceof Date ? ref : new Date();
  const lastHour = base.getHours();
  const labels = Array.from({ length: lastHour + 1 }, (_, i) => String(i).padStart(2, '0'));
  const empty = () => ({ app: Array(labels.length).fill(0), pc: Array(labels.length).fill(0), kw: Array(labels.length).fill(0) });
  const byApp = {};
  (rows || []).forEach((r) => {
    const appId = r.app_id;
    const hour = Number(r.hh);
    if (appId == null || !Number.isFinite(hour) || hour > lastHour) return;
    const bucket = (byApp[appId] = byApp[appId] || empty());
    const key = { app: 'app', pc: 'pc', kw: 'kw' }[r.ch];
    if (!key) return;
    bucket[key][hour] = Number(r.hits) || 0;
  });
  return { labels, byApp };
}

/** 今日行动量（下载 / 预约）→ { [appId]: { downloads, reserves } } */
export function transformAppTodayAction(rows) {
  const byApp = {};
  (rows || []).forEach((r) => {
    const appId = r.app_id;
    if (appId == null) return;
    const bucket = (byApp[appId] = byApp[appId] || { downloads: 0, reserves: 0 });
    const v = Number(r.v) || 0;
    if (r.kind === 'dl') bucket.downloads += v;
    else if (r.kind === 'rs') bucket.reserves += v;
  });
  return byApp;
}
