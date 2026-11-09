/** TapTap 报表 SQL 汇总出口：按业务域拆分在 shared / download / online / reserve / ad */
export * from './shared';
export * from './download';
export * from './online';
export * from './reserve';
export * from './ad';

/** 日期/窗口工具仍在 dates.js，这里一并再导出，保持既有 `from './sql'` 引用可用 */
export {
  recentDaysWhere,
  recentHoursWhere,
  thisWeekWhere,
  recentMonthsWhere,
  weekRange,
  formatNowWindow,
  SNAPSHOT_GRACE_MINUTES,
  isCurrentHourReady,
  currentHourKey,
} from '../../dates';
