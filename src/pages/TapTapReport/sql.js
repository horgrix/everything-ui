/**
 * 兼容入口：SQL 已按业务域拆分到 ./data/sql/ 目录
 * （shared / download / online / reserve / ad），这里统一再导出。
 */
export * from './data/sql/index';
