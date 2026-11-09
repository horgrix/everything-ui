/**
 * TapTap 报表的日期/窗口工具
 *
 * 抓取表的时间格式：
 *   小时表 crawled_at = 'YYYY-MM-DD HH'
 *   日表   crawled_at = 'YYYY-MM-DD'
 *   月表   crawled_at = 'YYYY-MM'
 * 这里集中所有「相对当前时间」的窗口计算，避免各页面各写一份。
 */

const pad2 = (n) => String(n).padStart(2, '0');

/** 本地日期 → 'YYYY-MM-DD' */
export const toDateStr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** 最近 N 天（返回起始日期 'YYYY-MM-DD'） */
export function recentDaysWhere(days = 3) {
  return toDateStr(new Date(Date.now() - days * 86400000));
}

/** 最近 N 小时（返回起始小时 'YYYY-MM-DD HH'） */
export function recentHoursWhere(hours) {
  const start = new Date(Date.now() - hours * 3600000);
  return `${toDateStr(start)} ${pad2(start.getHours())}`;
}

/** 本周一（weeksBack 周前）的日期 'YYYY-MM-DD' —— 兼作「上周一」与「下周一」 */
export function thisWeekWhere(weeksBack = 0) {
  const now = new Date();
  const diff = (now.getDay() + 6) % 7; // 距周一的天数（周日=0 → 6）
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff - weeksBack * 7);
  return toDateStr(monday);
}

/** 最近 N 个月的起始月 'YYYY-MM' */
export function recentMonthsWhere(months) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - months, 1);
  return `${start.getFullYear()}-${pad2(start.getMonth() + 1)}`;
}

/** 计算「上周一 ~ 本周日」（本周按周一为首日） */
export function weekRange(ref = new Date()) {
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const mondayOffset = (today.getDay() + 6) % 7; // 周一=0
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - mondayOffset);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  const thisSunday = new Date(thisMonday);
  thisSunday.setDate(thisMonday.getDate() + 6);
  return { lastMonday: toDateStr(lastMonday), thisMonday: toDateStr(thisMonday), thisSunday: toDateStr(thisSunday) };
}

/** 当前时间按窗口粒度格式化为抓取表的 key（hour: 'YYYY-MM-DD HH'，day: 'YYYY-MM-DD'，month: 'YYYY-MM'） */
export function formatNowWindow(granularity) {
  const now = new Date();
  if (granularity === 'month') return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  if (granularity === 'day') return toDateStr(now);
  return `${toDateStr(now)} ${pad2(now.getHours())}`;
}

/** 快照小时键的宽限分钟：当前小时前 N 分钟抓取数据还没入库，此时回退到上一小时 */
export const SNAPSHOT_GRACE_MINUTES = 15;

/** 「本时段」是否已过宽限分钟（false 表示展示的是上一小时） */
export function isCurrentHourReady(graceMinutes = SNAPSHOT_GRACE_MINUTES) {
  return new Date().getMinutes() >= graceMinutes;
}

/**
 * 快照小时键（与抓取表 crawled_at 的 'YYYY-MM-DD HH' 格式一致）
 * 当前小时不满 graceMinutes 分钟时（如 11:07）回退到上一小时（10），避免查到空数据。
 */
export function currentHourKey(graceMinutes = SNAPSHOT_GRACE_MINUTES) {
  const now = new Date();
  const at = new Date(now);
  if (now.getMinutes() < graceMinutes) at.setHours(at.getHours() - 1); // 0 点会自然退到前一天 23 点
  return `${toDateStr(at)} ${pad2(at.getHours())}`;
}
