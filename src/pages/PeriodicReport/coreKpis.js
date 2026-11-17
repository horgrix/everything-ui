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
  {
    key: 'game_cnt',
    line: 'download',
    label: '有下载游戏款数',
    short: '下载款数',
    note: '整周下载量 > 0 的去重款数（采集覆盖到但下载为 0 的不算）',
    rosterKey: 'game_cnt_roster',
    roster: '当周下载量为 0',
  },
  {
    key: 'app_cnt',
    line: 'ad',
    label: '有推广游戏款数',
    short: '推广款数',
    note: '当周有广告投放的去重款数（广告源表只收有投放的 app）',
  },
  {
    key: 'online_game_cnt',
    line: 'online',
    label: '有在线的游戏款数',
    short: '在线款数',
    note: '整周出现过真实在线（online_players > 0 且不等于兜底值 100）的去重款数',
    rosterKey: 'online_game_cnt_roster',
    roster: '整周没有真实在线小时（只有兜底值）',
  },
  { key: 'download_total', line: 'download', label: '下载总量', short: '下载总量' },
  { key: 'ad_total', line: 'ad', label: '广告曝光', short: '广告曝光' },
  // 在线峰值的对外键名改过一次（online_peak → online_peak_players），两种都认
  { key: 'online_peak', aliases: ['online_peak_players'], line: 'online', label: '在线峰值', short: '在线峰值' },
];

/**
 * 「覆盖 X 款里 N 款是 0」那句说明：只在接口真给了 game_cnt_roster 时才出，前端不自己减出结论。
 * 返回 null 表示这条业务线这次不讲这句（接口还没透出覆盖数）。
 */
export function rosterNote(line) {
  const spec = CORE_KPI_SPEC.find((item) => item.line === line?.key && item.rosterKey);
  if (!spec) return null;
  const kpi = (line.kpis || []).find((item) => item.key === spec.key);
  // 两种送达方式都认：二方 KPI（接口现行的 MetricSpec 做法）或同名指标上的附加字段
  const rosterKpi = (line.kpis || []).find((item) => item.key === spec.rosterKey);
  const roster = typeof rosterKpi?.value === 'number' ? rosterKpi.value : kpi?.game_cnt_roster;
  if (typeof roster !== 'number' || typeof kpi?.value !== 'number') return null;
  const gap = roster - kpi.value;
  if (!(gap > 0)) return null;
  return `采集覆盖 ${fmtCount(roster)} 款，其中 ${fmtCount(gap)} 款${spec.roster}。`;
}

function fmtCount(value) {
  return Number(value).toLocaleString('zh-CN');
}

export function completeTrend(trend) {
  return (trend || []).filter((point) => point && point.isPartial !== true);
}

/** 覆盖款数只是说明用的旁证，不进 03 明细的指标格（免得和「有…款数」并排放成两个数去比） */
export function isRosterKpi(key) {
  return CORE_KPI_SPEC.some((spec) => spec.rosterKey && spec.rosterKey === key);
}

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
    return {
      ...kpi,
      // 显示名统一由这份清单管（接口只给中性字段名），note 优先用接口的，接口没给才用清单里的
      ...(spec.label ? { label: spec.label, shortLabel: spec.short || spec.label } : {}),
      ...(spec.label && !kpi.note && spec.note ? { note: spec.note } : {}),
    };
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

/**
 * 671（单小时同时在线款数最高）的取值小时：接口哪天透出 concurrent_game_cnt_at，
 * 就把「取值于 11-15 22」拼到 note 后面——它不等于 peak_hour（那是人数峰值那一小时，653 款），
 * 所以这里只读接口给的时间，前端不拿别的字段凑。没这个字段就原样返回。
 */
function noteWithHour(kpi) {
  const at = kpi?.concurrent_game_cnt_at || kpi?.online_game_cnt_hour;
  if (!at || (kpi.note || '').includes(at)) return kpi?.note;
  return kpi.note ? `${kpi.note}；取值于 ${at}` : `取值于 ${at}`;
}

/**
 * 03 业务线明细的长名也跟着这份清单走（同一批 KPI 在两处不该叫两个名字）。
 * 只覆盖清单里有的键，其余指标仍用接口 label（如「单小时同时在线款数最高」由后端定文案）。
 */
export function withLineLabels(report) {
  if (!report?.lines) return report;
  const byLine = new Map(CORE_KPI_SPEC.filter((spec) => spec.label).map((spec) => [spec.key, spec.label]));
  return {
    ...report,
    lines: report.lines.map((line) => ({
      ...line,
      kpis: (line.kpis || []).map((kpi) => ({
        ...kpi,
        ...(byLine.has(kpi.key) ? { label: byLine.get(kpi.key) } : {}),
        ...(noteWithHour(kpi) ? { note: noteWithHour(kpi) } : {}),
      })),
    })),
  };
}
