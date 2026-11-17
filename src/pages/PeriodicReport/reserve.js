/**
 * 预约（reserve）展示口径换算 —— 纯函数，不发请求
 *
 * 数据源：`crawler.dws_taptap_reserve_periodic_report` / `..._periodic_rank`
 * （DWS 侧结构与下载周期表一致：period_type + crawled_at + category_type/category_value）
 *
 * 三条硬口径（前端不自行放宽）：
 *   1. 预约采集任务是 2026-11-08 才上线的，更早的期**永久补不回来** → 不出期级趋势线，
 *      只给「本期值 + 日均 + 覆盖天数 + 榜」。
 *   2. W45 只盖了 1 天，按周总量算环比会得到 +592% 的假暴涨 → 只比**日均**，
 *      日均环比也要两期都真有覆盖才算。
 *   3. `reserve_total_end` 是「预约中、未上线」游戏的累计预约数，游戏上线就退出池子，
 *      所以跨期相减会掉（W45 9640 万 → W46 6961 万），它不是平台大盘增长率。
 *
 * 页面只做「换算与判定」，环比 / 覆盖天数优先用接口已给的值，接口没给才由这里补算。
 */

/** 分型编码 → 文案（与下载报表的 distLabels 同义） */
export const RESERVE_DIST_LABELS = { 0: '商业游戏', 1: '独立小游戏', 2: 'Maker 小游戏' };

const WEEK_DAYS = 7;

const num = (value) => {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** 该期「本应覆盖多少天」：周报 7 天；月报是月内已经过去的天数 */
export function expectedDaysOf(periodType, meta) {
  if (periodType === 'weekly') return WEEK_DAYS;
  const start = String(meta?.periodStart || '').slice(0, 10);
  const cutoff = String(meta?.isPartial ? meta?.updatedAt : meta?.periodEnd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) return null;
  const days = (Date.parse(`${cutoff}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000 + 1;
  return Number.isFinite(days) && days > 0 ? Math.round(days) : null;
}

function normalizeDist(raw, totalAdd) {
  const rows = Array.isArray(raw) ? raw : [];
  return rows
    .map((row) => {
      const type = num(row.type ?? row.distributionType);
      const add = num(row.reserveAdd ?? row.reserve_add);
      const givenShare = num(row.share);
      return {
        key: String(type ?? row.label ?? ''),
        label: row.label || RESERVE_DIST_LABELS[type] || '未分型',
        add,
        gameCnt: num(row.gameCnt ?? row.reserveGameCnt),
        roster: num(row.gameCntRoster ?? row.reserveGameCntRoster),
        // 分型各自的覆盖天数（W46 Maker 只有 4/7 天）；后端还没给这个字段时为 null，页面不显示徽标
        dayCnt: num(row.dayCnt ?? row.day_cnt),
        firstDay: row.firstDay || row.first_day || null,
        lastDay: row.lastDay || row.last_day || null,
        share: givenShare ?? (add != null && totalAdd ? (add / totalAdd) * 100 : null),
      };
    })
    .filter((row) => row.add != null || row.gameCnt != null)
    .sort((a, b) => (RESERVE_DIST_LABELS[a.key] ? Number(a.key) : 99) - (RESERVE_DIST_LABELS[b.key] ? Number(b.key) : 99));
}

function normalizeRankItem(row) {
  const type = num(row.distributionType ?? row.type);
  const gainValue = num(row.reserveAdd ?? row.value);
  const totalValue = num(row.totalReserveCount ?? row.total);
  return {
    rankNo: num(row.rankNo ?? row.rank_no),
    appId: row.appId ?? row.app_id ?? null,
    appName: row.appName ?? row.app_name ?? '—',
    icon: row.icon || null,
    distType: type,
    distLabel: row.distributionLabel || RESERVE_DIST_LABELS[type] || null,
    gain: gainValue,
    total: totalValue,
  };
}

/**
 * @param {Object} raw        接口给的 reserve 块（可能是 report.reserve，也可能是 /periodic/reserve）
 * @param {Object} ctx
 * @param {string} ctx.periodType  weekly | monthly
 * @param {Object} ctx.meta        报告 meta（算月报应有覆盖天数用）
 * @returns {Object|null} 归一后的展示模型；没有这份数据时返回 null（页面不出现该区块）
 */
export function normalizeReserve(raw, { periodType, meta } = {}) {
  if (!raw) return null;
  if (raw.available === false) {
    return { available: false, reason: raw.reason || raw.note || null };
  }

  const cov = raw.coverage || raw.coverageInfo || {};
  const head = raw.headline || raw.summary || raw;
  const dayCnt = num(cov.dayCnt ?? cov.day_cnt ?? head.dayCnt);
  // 后端 1cc0623 起自己算「期内到今天应覆盖几天」（月报尤其麻烦，前端不重算）：优先用它
  const expectedDays = num(cov.expectedDayCnt) ?? num(cov.expectedDays) ?? expectedDaysOf(periodType, meta);
  const firstDay = cov.firstDay || cov.first_day || null;
  const lastDay = cov.lastDay || cov.last_day || null;

  const add = num(head.reserveAdd ?? head.reserve_add ?? head.add);
  const dailyAvg = num(head.dailyAvg ?? head.daily_avg) ?? (add != null && dayCnt > 0 ? add / dayCnt : null);

  const prevAdd = num(head.prevReserveAdd ?? head.prev_reserve_add ?? head.prevAdd);
  const prevDayCnt = num(head.prevDayCnt ?? head.prev_day_cnt ?? head.prevDayCount);
  const prevDailyAvg =
    num(head.prevDailyAvg ?? head.prev_daily_avg) ?? (prevAdd != null && prevDayCnt > 0 ? prevAdd / prevDayCnt : null);
  const dailyAvgPct =
    num(head.dailyAvgPct ?? head.daily_avg_pct) ??
    (dailyAvg != null && prevDailyAvg ? ((dailyAvg - prevDailyAvg) / prevDailyAvg) * 100 : null);

  const dist = normalizeDist(raw.dist, add);
  const ranksRaw = raw.ranks || {};
  const gain = (ranksRaw.gain || []).map(normalizeRankItem);
  const total = (ranksRaw.total || []).map(normalizeRankItem);

  // 覆盖不满该期的天数时，日均是「已覆盖那些天」的日，不能当整期节奏（后端给了 partial 就采信）
  const thinCoverage = cov.partial === true || (dayCnt != null && expectedDays != null && dayCnt < expectedDays);
  // 上期完全没有覆盖（预约任务上线前）时不给环比结论
  const hasPrevCoverage = prevDailyAvg != null;
  // 上期也只盖了几天（W45 只有 1 天）时，日均环比是把「1 天的日均」和「7 天的日均」比，天然含周末效应；
  // 后端给了 dailyAvgComparable 就听它的，没给则要求上期覆盖天数达到整期
  const prevExpectedDays = num(head.prevExpectedDayCnt) ?? num(head.prevExpectedDays) ?? (periodType === 'weekly' ? WEEK_DAYS : null);
  const prevThin = prevDayCnt != null && prevExpectedDays != null && prevDayCnt < prevExpectedDays;
  const comparable =
    typeof head.dailyAvgComparable === 'boolean'
      ? head.dailyAvgComparable
      : Boolean(hasPrevCoverage && !thinCoverage && !prevThin);
  // 期初早于预约采集起点（11-08）的那几天永远不会有数据 —— 这不是缺口，别标黄
  const startLimited = cov.startLimited === true;
  // 本期还没走完（今天/昨天才收了一半）—— 也不是缺口，是「进行中」
  const periodInProgress = cov.periodInProgress === true;

  // 为什么不出日均环比：上期早于采集起点 / 本期还在进行中 / 本期没采满 / 上期没采满。
  // 后端 6eba707 起统一由 dailyAvgBlocked 给这四种（顺序即优先级）；没这个字段时前端自己判。
  const blocked =
    head.dailyAvgBlocked ||
    (!hasPrevCoverage
      ? 'prev_missing'
      : periodInProgress
        ? 'current_in_progress'
        : thinCoverage
          ? 'current_partial'
          : prevThin
            ? 'prev_partial'
            : null);

  return {
    available: true,
    coverage: { dayCnt, expectedDays, firstDay, lastDay, thinCoverage, startLimited, periodInProgress },
    headline: {
      add,
      dailyAvg,
      // 日均环比只在两期覆盖都够整期时给结论，否则只把数摆出来、不让人读成涨跌
      dailyAvgPct: comparable ? dailyAvgPct : null,
      dailyAvgComparable: comparable,
      dailyAvgBlocked: blocked,
      prevAdd,
      prevDayCnt,
      prevExpectedDays,
      prevPeriodKey: head.prevPeriodKey ?? head.prev_period_key ?? null,
      prevDailyAvg: hasPrevCoverage ? prevDailyAvg : null,
      gameCnt: num(head.gameCnt ?? head.reserveGameCnt),
      roster: num(head.gameCntRoster ?? head.reserveGameCntRoster),
      totalEnd: num(head.reserveTotalEnd ?? head.reserve_total_end ?? head.totalEnd),
    },
    dist,
    ranks: { gain, total },
    note: raw.note || null,
  };
}

/** 期次文案：周报 2026-45 → W45，月报 2026-10 → 10 月 */
export function periodLabelOf(key, periodType) {
  const text = String(key || '');
  const tail = text.slice(5);
  if (!tail) return null;
  if (periodType === 'monthly') return `${Number(tail)} 月`;
  return `W${tail}`;
}

/**
 * 覆盖天数文案：7/7 天 · 11-09~11-15
 * 期初早于采集起点时补「上线首周」、还没走完补「进行中」——这两种都不是缺口，不该被读成不完整。
 */
export function coverageText(coverage) {
  if (!coverage || coverage.dayCnt == null) return null;
  const { dayCnt, expectedDays, firstDay, lastDay, startLimited, periodInProgress } = coverage;
  const span = firstDay && lastDay ? ` · ${firstDay.slice(5)}~${lastDay.slice(5)}` : '';
  const head = expectedDays != null ? `${dayCnt}/${expectedDays} 天` : `${dayCnt} 天`;
  const note = periodInProgress ? ' · 进行中' : startLimited ? ' · 上线首周' : '';
  return `${head}${span}${note}`;
}
