/**
 * 核心指标清单（01 区块的 6 张卡 + 02 趋势的标签页都用它定序）
 *
 * 口径是「三款数 + 三总量」：
 *   有下载游戏款数、有推广游戏款数、有在线的游戏款数
 *   下载总量、广告曝光、在线峰值
 *
 * 为什么在前端定序：接口 `/report` 自己吐的 `coreKpis` 是老顺序（在线游戏数、在线峰值、
 * 下载总量、PC 下载量、APP 下载量、广告曝光）。这三款数其实接口已经算好了，只是放在
 * 业务线明细 `lines[].kpis` 里（game_cnt / app_cnt / online_game_cnt），字段结构与
 * coreKpis 完全一致（环比、trend、availablePeriods、deltaBlocked…），所以换清单不需要等
 * 接口发版。等后端 coreKpis 也改成这份清单后，这里取的还是同一批对象，是幂等的。
 *
 * 被移出核心区的 PC / APP 下载量没有丢：它们在「03 业务线明细 → TapTap 下载」里照旧展示，
 * 「本期要点」里的下载结构（APP 占比 / PC 占比）也仍然从业务线里取数。
 */

/** 顺序即网格顺序（一行 3 个：三款数 → 三总量） */
export const CORE_KPI_SPEC = [
  { key: 'game_cnt', line: 'download', label: '有下载游戏款数' },
  { key: 'app_cnt', line: 'ad', label: '有推广游戏款数' },
  { key: 'online_game_cnt', line: 'online', label: '有在线的游戏款数' },
  { key: 'download_total', line: 'download' },
  { key: 'ad_total', line: 'ad' },
  // 在线峰值的对外键名改过一次（online_peak → online_peak_players），两种都认
  { key: 'online_peak', aliases: ['online_peak_players'], line: 'online' },
];

/**
 * 把一期报告里所有 KPI 收进一张表：业务线明细优先，coreKpis 兜底。
 * （两边同名 KPI 的数值与口径字段一致，业务线那份多带分型上下文，优先用它。）
 */
export function indexedKpis(report) {
  const pool = new Map();
  (report?.lines || []).forEach((line) => {
    (line.kpis || []).forEach((kpi) => {
      if (kpi?.key) pool.set(kpi.key, { ...kpi, line: kpi.line || line.key });
    });
  });
  (report?.coreKpis || []).forEach((kpi) => {
    if (kpi?.key && !pool.has(kpi.key)) pool.set(kpi.key, kpi);
  });
  return pool;
}

/**
 * 按 CORE_KPI_SPEC 重排一期报告的 coreKpis；缺的键跳过（不补 0、不造值）。
 * 万一清单里的键接口一个都没有（接口回退到很老的版本），原样返回，避免把区块清空。
 */
export function withCoreKpis(report) {
  if (!report) return report;
  const pool = indexedKpis(report);

  const resolved = CORE_KPI_SPEC.map((spec) => {
    const keys = [spec.key, ...(spec.aliases || [])];
    const key = keys.find((k) => pool.has(k));
    if (!key) return null;
    const kpi = pool.get(key);
    return spec.label ? { ...kpi, label: spec.label } : kpi;
  }).filter(Boolean);

  if (!resolved.length) return report;

  if (import.meta.env.DEV) {
    const missing = CORE_KPI_SPEC.filter(
      (spec) => ![spec.key, ...(spec.aliases || [])].some((k) => pool.has(k))
    ).map((spec) => spec.key);
    if (missing.length) console.warn('[periodic] 核心指标清单里有键没取到，已跳过：', missing);
  }

  return { ...report, coreKpis: resolved };
}
