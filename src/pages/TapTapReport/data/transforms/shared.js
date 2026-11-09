/**
 * TapTap 报表数据转换 —— 公共小工具（周几标签、本周起点、按周拆分）
 */

/** 周几标签（周一到周日） */
export const WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/** 最新数据时间（字符串，无数据时为 null） */
export function transformNewestDate(rows) {
  if (!rows || !rows.length) return null;
  return rows[0].newest_datestr;
}

/** TapApp首页找游戏广告每日投放趋势（app_id -> 每日投放次数，共用日期横轴） */
/** 周几标签（周一为一周起点） */
export const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/** 本周一 00:00（本地时间） */
export function mondayOfThisWeek() {
  const now = new Date();
  const diff = (now.getDay() + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
}

/**
 * 把「日期 → 值」的行按周几拆分成本周/上周两条 7 长度序列（周一=0…周日=6）。
 * @param {Array} rows 含 day / push_cnt 的行
 * @param {(row) => string} keyFn 分组键（按 app 或固定常量）
 */
export function splitDailyByWeek(rows, keyFn) {
  const thisWeek = {};
  const lastWeek = {};
  const monday = mondayOfThisWeek().getTime();
  rows.forEach((r) => {
    const dayStr = String(r.day || '').slice(0, 10);
    const d = new Date(`${dayStr}T00:00:00`);
    if (Number.isNaN(d.getTime())) return;
    const idx = (d.getDay() + 6) % 7;
    const bucket = d.getTime() >= monday ? thisWeek : lastWeek;
    const key = keyFn(r);
    if (!bucket[key]) bucket[key] = new Array(7).fill(null);
    bucket[key][idx] = Number(r.push_cnt || 0);
  });
  return { thisWeek, lastWeek };
}

/** 本周周一的 Date（本地时区，周一为一周起点） */
export function thisMonday() {
  const now = new Date();
  const diff = (now.getDay() + 6) % 7; // 距周一的天数（周日=0 → 6）
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
}
