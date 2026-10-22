/**
 * 数据更新频率相关的时间计算
 * - everyHours=2 → cron「分钟 N，每 2 小时一次」
 * - everyHours=1 → cron「分钟 N，每小时一次」
 * - nextDailyUpdateTime → cron「分 时 * * *」固定时刻（如每天 23:07）
 */

/** 按更新频率 cron 计算下次更新时间（minute=分钟，everyHours=间隔小时数） */
export function nextUpdateTime(minute = 7, from = new Date(), everyHours = 2) {
  const d = new Date(from.getTime());
  d.setSeconds(0, 0);
  d.setMinutes(minute);
  // 已超过本小时的该分钟 → 推到下一个小时
  if (from.getMinutes() >= minute) d.setHours(d.getHours() + 1);
  // 间隔 2 小时时，目标小时必须是偶数小时（0/2/4/…/22）
  if (everyHours > 1) {
    while (d.getHours() % everyHours !== 0) d.setHours(d.getHours() + 1);
  }
  return d;
}

/** 格式化下次更新时间：MM-DD HH:mm */
export function formatNextUpdate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 生成「下次更新时间 MM-DD HH:mm」文案（渲染时计算一次，不轮询） */
export function nextUpdateLabel(minute = 7, from = new Date(), everyHours = 2) {
  return `下次更新时间 ${formatNextUpdate(nextUpdateTime(minute, from, everyHours))}`;
}

/** 按固定时刻（cron: 分 时 * * *，如每天 23:07）计算下次更新时间 */
export function nextDailyUpdateTime(minute = 7, hour = 23, from = new Date()) {
  const d = new Date(from.getTime());
  d.setHours(hour, minute, 0, 0);
  // 今日该时刻已过（或正好到点）→ 顺延到明天
  if (d.getTime() <= from.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

/** 生成固定时刻的「下次更新时间」文案 */
export function nextDailyUpdateLabel(minute = 7, hour = 23, from = new Date()) {
  return `下次更新时间 ${formatNextUpdate(nextDailyUpdateTime(minute, hour, from))}`;
}
