import { WEEKDAY_LABELS, mondayOfThisWeek, splitDailyByWeek, thisMonday } from './shared';

/**
 * TapTap 广告数据转换（广告大盘 / 渠道明细 / 榜单）
 */

/**
 * TapTap 广告大盘日趋势：指标按周几对齐，拆成本周 / 上周两条序列。
 * 指标口径（广告数含 pcebid，已在 SQL 里 SUM 好）：ad_views / app_ad_views / pc_ad_views / kw_ad_views。
 * 某天缺失或为 NULL 则留 null，让折线断开，而不是伪装成 0。
 */
export function transformAdAggrDailyTrend(rows) {
  const METRIC_FIELDS = {
    adViews: 'ad_views',
    appAdViews: 'app_ad_views',
    pcAdViews: 'pc_ad_views',
    kwAdViews: 'kw_ad_views',
  };
  const keys = Object.keys(METRIC_FIELDS);
  const blankBucket = () => {
    const bucket = {};
    keys.forEach((k) => { bucket[k] = new Array(7).fill(null); });
    return bucket;
  };

  const result = {
    labels: WEEKDAY_LABELS,
    thisWeek: blankBucket(),
    lastWeek: blankBucket(),
    hasLastWeek: false,
  };

  const toNum = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const mondayDate = mondayOfThisWeek();
  const monday = mondayDate.getTime();
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  result.range = {
    thisWeekStart: fmt(mondayDate),
    lastWeekStart: fmt(new Date(monday - 7 * 86400000)),
  };

  (rows || []).forEach((r) => {
    const dayStr = String(r.day || r.crawled_at || '').slice(0, 10);
    const d = new Date(`${dayStr}T00:00:00`);
    if (Number.isNaN(d.getTime())) return;
    const idx = (d.getDay() + 6) % 7;
    const isThisWeek = d.getTime() >= monday;
    const bucket = isThisWeek ? result.thisWeek : result.lastWeek;
    let hasValue = false;
    keys.forEach((k) => {
      const v = toNum(r[METRIC_FIELDS[k]]);
      bucket[k][idx] = v;
      if (v != null) hasValue = true;
    });
    if (!isThisWeek && hasValue) result.hasLastWeek = true;
  });

  return result;
}

/**
 * TapTap 广告占比（本周 vs 上周）：把周汇总拆成 APP / PC / KW 三段，并算好占比。
 * 返回 { categories: ['本周','上周'], weeks: [{ label, app, pc, kw, total, pcts: {app,pc,kw} }, ...] }
 * 本周在前；某周无数据时值为 null（图上就是空柱，不补 0 伪装成“确实是 0”）。
 */
export function transformAdShareByWeek(rows) {
  const numOrNull = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const pct = (v, total) => (v == null || !total ? null : parseFloat(((v / total) * 100).toFixed(1)));

  const build = (row) => {
    if (!row) return { app: null, pc: null, kw: null, total: null, pcts: { app: null, pc: null, kw: null } };
    const app = numOrNull(row.app_ad_views);
    const pc = numOrNull(row.pc_ad_views);
    const kw = numOrNull(row.kw_ad_views);
    const hasAny = app != null || pc != null || kw != null;
    const total = hasAny ? (app || 0) + (pc || 0) + (kw || 0) : null;
    return {
      app,
      pc,
      kw,
      total,
      pcts: { app: pct(app, total), pc: pct(pc, total), kw: pct(kw, total) },
    };
  };

  const thisRow = (rows || []).find((r) => r.week_key === 'this');
  const lastRow = (rows || []).find((r) => r.week_key === 'last');
  return {
    categories: ['本周', '上周'],
    weeks: [
      { label: '本周', ...build(thisRow) },
      { label: '上周', ...build(lastRow) },
    ],
  };
}

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
 * TapPC 广告本周明细：把 (app_id, 日期) 行聚合成「橱窗广告 / 每日新发现广告」两张表的数据。
 * - count：本周该渠道的广告投放次数（橱窗=top_ad_views，发现位=discovery_ad_views）
 * - trend：周一 → 周日 7 个点，没有数据的日子为 null（sparkline 不画点）
 * 两张表各自按投放次数倒序，只保留广告投放次数 > 0 的游戏，取前 limit 个（默认 Top 5）。
 */
export function transformPcAdWeeklyDetail(rows, limit = 5) {
  const monday = thisMonday();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return { key: `${d.getFullYear()}-${mm}-${dd}`, label: `周${'一二三四五六日'[i]} ${mm}-${dd}` };
  });
  const labels = days.map((d) => d.label);

  const byApp = new Map();
  (rows || []).forEach((r) => {
    const appId = r.app_id;
    if (appId == null) return;
    if (!byApp.has(appId)) {
      byApp.set(appId, { appId, appName: r.app_name || '', icon: r.icon || '', tags: [r.tag_1, r.tag_2, r.tag_3].filter(Boolean), top: {}, discovery: {} });
    }
    const item = byApp.get(appId);
    if (!item.appName && r.app_name) item.appName = r.app_name;
    if (!item.icon && r.icon) item.icon = r.icon;
    const dayKey = String(r.day || '').slice(0, 10);
    item.top[dayKey] = (item.top[dayKey] || 0) + Number(r.top_ad_views || 0);
    item.discovery[dayKey] = (item.discovery[dayKey] || 0) + Number(r.discovery_ad_views || 0);
  });

  const build = (field) =>
    [...byApp.values()]
      .map((item) => ({
        appId: item.appId,
        appName: item.appName,
        icon: item.icon,
        tags: item.tags,
        count: Object.values(item[field]).reduce((a, b) => a + b, 0),
        trend: days.map((d) => (item[field][d.key] == null ? null : item[field][d.key])),
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

  return { labels, top: build('top'), discovery: build('discovery') };
}

/**
 * TapApp 首页广告本周明细：按游戏聚合 Android 广告 / iOS 广告 / 资源互换(pcebid) 三段投放次数，
 * 并给出周一 → 周日 7 点趋势（三段之和，没数据的日子为 null）。
 * 只保留总投放次数 > 0 的游戏，按总次数倒序取前 limit 个（默认 Top 10）。
 */
export function transformTapAppLandingAdWeeklyDetail(rows, limit = 10) {
  const monday = thisMonday();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return { key: `${d.getFullYear()}-${mm}-${dd}`, label: `周${'一二三四五六日'[i]} ${mm}-${dd}` };
  });

  const byApp = new Map();
  (rows || []).forEach((r) => {
    const appId = r.app_id;
    if (appId == null) return;
    if (!byApp.has(appId)) {
      byApp.set(appId, {
        appId,
        appName: r.app_name || '',
        icon: r.icon || '',
        tags: [r.tag_1, r.tag_2, r.tag_3].filter(Boolean),
        android: 0,
        ios: 0,
        pcebid: 0,
        byDay: {},
      });
    }
    const item = byApp.get(appId);
    if (!item.appName && r.app_name) item.appName = r.app_name;
    if (!item.icon && r.icon) item.icon = r.icon;
    const android = Number(r.android_ad_views || 0);
    const ios = Number(r.ios_ad_views || 0);
    const pcebid = Number(r.pcebid_views || 0);
    item.android += android;
    item.ios += ios;
    item.pcebid += pcebid;
    const dayKey = String(r.day || '').slice(0, 10);
    item.byDay[dayKey] = (item.byDay[dayKey] || 0) + android + ios + pcebid;
  });

  const list = [...byApp.values()]
    .map((item) => ({
      appId: item.appId,
      appName: item.appName,
      icon: item.icon,
      tags: item.tags,
      android: item.android,
      ios: item.ios,
      pcebid: item.pcebid,
      count: item.android + item.ios + item.pcebid,
      trend: days.map((d) => (item.byDay[d.key] == null ? null : item.byDay[d.key])),
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return { labels: days.map((d) => d.label), rows: list };
}

/**
 * TapApp 搜索关键词广告本周明细：三个渠道（搜索发现 / 热搜 / 热点）各出一张表的数据。
 * 每个渠道按游戏聚合 Android/iOS 广告投放次数 + 周一→周日 7 点趋势；
 * 只保留该渠道投放次数 > 0 的游戏，按次数倒序取前 limit 个（默认 Top 15）。
 */
export function transformTapAppKeywordAdWeeklyDetail(rows, limit = 15) {
  const monday = thisMonday();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return { key: `${d.getFullYear()}-${mm}-${dd}`, label: `周${'一二三四五六日'[i]} ${mm}-${dd}` };
  });

  /** 渠道 → [Android 字段, iOS 字段] */
  const CHANNELS = {
    discover: ['discover_android', 'discover_ios'],
    hotSearch: ['hot_search_android', 'hot_search_ios'],
    hotSpot: ['hot_spot_android', 'hot_spot_ios'],
  };

  const byApp = new Map();
  (rows || []).forEach((r) => {
    const appId = r.app_id;
    if (appId == null) return;
    if (!byApp.has(appId)) {
      byApp.set(appId, {
        appId,
        appName: r.app_name || '',
        icon: r.icon || '',
        tags: [r.tag_1, r.tag_2, r.tag_3].filter(Boolean),
        byChannel: {},
      });
    }
    const item = byApp.get(appId);
    if (!item.appName && r.app_name) item.appName = r.app_name;
    if (!item.icon && r.icon) item.icon = r.icon;
    if (item.tags.length === 0) item.tags = [r.tag_1, r.tag_2, r.tag_3].filter(Boolean);
    const dayKey = String(r.day || '').slice(0, 10);
    Object.entries(CHANNELS).forEach(([channel, [androidField, iosField]]) => {
      const android = Number(r[androidField] || 0);
      const ios = Number(r[iosField] || 0);
      if (android + ios === 0) return;
      if (!item.byChannel[channel]) item.byChannel[channel] = { android: 0, ios: 0, byDay: {} };
      const bucket = item.byChannel[channel];
      bucket.android += android;
      bucket.ios += ios;
      bucket.byDay[dayKey] = (bucket.byDay[dayKey] || 0) + android + ios;
    });
  });

  const build = (channel) =>
    [...byApp.values()]
      .map((item) => {
        const bucket = item.byChannel[channel] || { android: 0, ios: 0, byDay: {} };
        return {
          appId: item.appId,
          appName: item.appName,
          icon: item.icon,
          tags: item.tags,
          android: bucket.android,
          ios: bucket.ios,
          count: bucket.android + bucket.ios,
          trend: days.map((d) => (bucket.byDay[d.key] == null ? null : bucket.byDay[d.key])),
        };
      })
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

  return {
    labels: days.map((d) => d.label),
    discover: build('discover'),
    hotSearch: build('hotSearch'),
    hotSpot: build('hotSpot'),
  };
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

/** TapTap 广告大盘：按 app 的每日总投放趋势，按周几对齐成本周 / 上周两条 7 长度序列 */
export function transformAdGameDailyTrend(rows) {
  if (!rows || !rows.length) return { labels: WEEKDAY_LABELS, thisWeek: {}, lastWeek: {} };
  const { thisWeek, lastWeek } = splitDailyByWeek(rows, (r) => r.app_id);
  return { labels: WEEKDAY_LABELS, thisWeek, lastWeek };
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

/**
 * 投放 TopN 排名 → { snapshot, rows: [{ appId, appName, rank, appAdViews, pcAdViews, kvAdViews, totalAdViews }] }
 * 总投放拆成 APP / PC / KV 三段（rank 表 total_app_ad_views / total_pc_ad_views / total_kv_ad_views），
 * 总投放取三段之和；若某行缺这三列（历史数据），退回用 total_ad_veiws 作为标签值。
 */
export function transformAdRankTop(rows) {
  return {
    snapshot: rows?.[0]?.crawled_at || '',
    rows: (rows || []).map((r) => {
      const appAdViews = Number(r.total_app_ad_views) || 0;
      const pcAdViews = Number(r.total_pc_ad_views) || 0;
      const kvAdViews = Number(r.total_kv_ad_views) || 0;
      const splitSum = appAdViews + pcAdViews + kvAdViews;
      return {
        appId: r.app_id,
        appName: r.app_name || String(r.app_id),
        rank: Number(r.ad_rank) || 0,
        appAdViews,
        pcAdViews,
        kvAdViews,
        totalAdViews: splitSum > 0 ? splitSum : Number(r.total_ad_veiws) || 0,
      };
    }),
  };
}

/**
 * 每日投放广告的游戏数：按周几拆成本周 / 上周两条 7 长度序列，并算出逐日增幅(%)。
 * 缺数据的日子为 null（不补 0 伪装），上周为 0 或缺失时增幅为 null。
 */
export function transformAdGameCountWeekly(rows) {
  const games = { last: new Array(7).fill(null), this: new Array(7).fill(null) };
  const pushes = { last: new Array(7).fill(null), this: new Array(7).fill(null) };
  const monday = mondayOfThisWeek().getTime();

  (rows || []).forEach((r) => {
    const dayStr = String(r.day || '').slice(0, 10);
    const d = new Date(`${dayStr}T00:00:00`);
    if (Number.isNaN(d.getTime())) return;
    const idx = (d.getDay() + 6) % 7;
    const gameCnt = r.games == null ? null : Number(r.games);
    if (gameCnt == null || Number.isNaN(gameCnt)) return;
    const pushCnt = r.pushes == null ? null : Number(r.pushes);
    const bucket = d.getTime() >= monday ? 'this' : 'last';
    games[bucket][idx] = gameCnt;
    pushes[bucket][idx] = pushCnt;
  });

  /** 逐日增幅(%)：两个数都存在且上周不为 0 才算，保留 1 位小数 */
  const deltaOf = (last, cur) =>
    last.map((lastVal, i) => {
      const curVal = cur[i];
      if (lastVal == null || curVal == null || lastVal === 0) return null;
      return Math.round(((curVal - lastVal) / lastVal) * 1000) / 10;
    });

  /** 每个游戏平均广告数 = 当日广告数 ÷ 当日有投放的游戏数，保留 1 位小数 */
  const perGameOf = (pushArr, gameArr) =>
    pushArr.map((p, i) => {
      const g = gameArr[i];
      if (p == null || g == null || g === 0) return null;
      return Math.round((p / g) * 10) / 10;
    });

  const lastPerGame = perGameOf(pushes.last, games.last);
  const thisPerGame = perGameOf(pushes.this, games.this);

  return {
    labels: WEEKDAY_LABELS,
    // 1) 每日有投放的游戏数
    lastWeek: games.last,
    thisWeek: games.this,
    delta: deltaOf(games.last, games.this),
    // 2) 每日广告投放数
    lastPushes: pushes.last,
    thisPushes: pushes.this,
    pushDelta: deltaOf(pushes.last, pushes.this),
    // 3) 每个游戏平均广告数
    lastPerGame,
    thisPerGame,
    perGameDelta: deltaOf(lastPerGame, thisPerGame),
  };
}
