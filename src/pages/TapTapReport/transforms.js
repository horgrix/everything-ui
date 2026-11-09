/**
 * 兼容入口：数据转换已按业务域拆分到 ./data/transforms/ 目录
 * （shared / download / reserve / online / ad），这里统一再导出。
 */
export * from './data/transforms/index';
