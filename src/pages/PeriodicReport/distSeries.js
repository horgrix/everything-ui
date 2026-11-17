/**
 * 「小游戏下载量」与下载结构趋势
 *
 * 小游戏 = 独立小游戏 + Maker 小游戏（按游戏品类切分），跟 APP / PC（按平台切分）是**两个不同的维度**：
 * 品类三类合计等于下载总量，平台两类也等于下载总量，所以「小游戏」会和 APP/PC 有重叠，
 * 不能把 APP + PC + 小游戏加在一起。页面上只做趋势对照，不做加总，脚注里也照这个说法写。
 *
 * 当期值直接来自 `/report` 的 `breakdown.items`（那里有 独立小游戏 / Maker 小游戏 两行）。
 * **逐期趋势接口目前没有给**：`breakdown.items[]` 上没有 trend，只有当期值。
 * 所以这里做两件事：
 *   ① 如果后端哪天给 `breakdown.items[].trend`，优先用它（零额外请求）；
 *   ② 否则按需要的期次补拉对应的 `/report`，只为拿到那期的分型值（约 21KB/期，react-query 缓存 5 分钟）。
 *      —— 等 ② 变成 ①，这个文件里的 useQuery 分支就可以整段删掉。
 */
import { useQuery } from '@tanstack/react-query';
import { fetchReport } from '../../api/periodic';

/** 独立小游戏 / Maker 小游戏（以后加新小游戏品类，只要 label 里带「小游戏」就会自动进来） */
const SMALL_GAME_LABEL = /小游戏/;

/** 趋势窗口：跟 02 趋势一致，最多 8 期（含本期） */
export const TREND_WINDOW = 8;

/** 一条业务线当期的小游戏下载量（value / games 分开取） */
export function smallGameOf(line) {
  const items = line?.breakdown?.items || [];
  const picked = items.filter((item) => SMALL_GAME_LABEL.test(item.label || '') && item.value != null);
  if (!picked.length) return null;
  return {
    value: picked.reduce((sum, item) => sum + item.value, 0),
    games: picked.reduce((sum, item) => sum + (item.games || 0), 0),
    labels: picked.map((item) => item.label),
  };
}

/** 接口若在分型行上给了逐期趋势，直接用它（优先于补拉） */
function smallGameTrendFromApi(line) {
  const items = (line?.breakdown?.items || []).filter((item) => SMALL_GAME_LABEL.test(item.label || ''));
  const withTrend = items.filter((item) => Array.isArray(item.trend) && item.trend.length);
  if (withTrend.length !== items.length || !items.length) return null;
  const merged = new Map();
  withTrend.forEach((item) => {
    item.trend.forEach((point) => {
      if (!point?.period) return;
      merged.set(point.period, (merged.get(point.period) || 0) + (point.value || 0));
    });
  });
  return merged.size ? merged : null;
}

/**
 * 逐期小游戏下载量。
 * @returns {Map<string, number>} period → value
 */
export function useSmallGameSeries(report, periodType, periodKeys) {
  const line = report?.lines?.find((item) => item.key === 'download');
  const fromApi = smallGameTrendFromApi(line);
  const currentKey = report?.meta?.periodKey;
  const need = fromApi
    ? []
    : (periodKeys || []).filter((key) => key && key !== currentKey).slice(-TREND_WINDOW);

  const query = useQuery({
    queryKey: ['pr-small-game', periodType, need.join('|')],
    enabled: need.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const reports = await Promise.all(need.map((key) => fetchReport(periodType, key).catch(() => null)));
      const map = {};
      need.forEach((key, index) => {
        const value = smallGameOf(reports[index]?.lines?.find((item) => item.key === 'download'))?.value;
        if (typeof value === 'number') map[key] = value;
      });
      return map;
    },
  });

  // 本期用 /report 里的分型值兜底，其余期用拉回来的
  const series = new Map();
  if (fromApi) fromApi.forEach((value, key) => series.set(key, value));
  else Object.entries(query.data || {}).forEach(([key, value]) => series.set(key, value));
  const current = smallGameOf(line);
  if (current) series.set(currentKey, current.value);

  return { series, ready: Boolean(fromApi) || !query.isLoading, source: fromApi ? 'api' : 'report' };
}

function pctChange(value, prev) {
  if (typeof value !== 'number' || typeof prev !== 'number' || !prev) return null;
  return ((value - prev) / prev) * 100;
}

/**
 * 组装下载结构趋势（总量 / APP / PC / 小游戏），只保留 ≤ 当前期次、且有值的期。
 * 02 趋势里的 kpi.trend 会带出比当前期更晚的期（例如看 W46 时已含进行中的 W47），
 * 这里直接裁掉，免得图末尾出现一根「还没走完」的断崖。
 */
export function buildDownloadTrend(report, smallGameSeries) {
  const line = report?.lines?.find((item) => item.key === 'download');
  const currentKey = report?.meta?.periodKey;
  const kpiOf = (key) => line?.kpis?.find((item) => item.key === key);
  const total = kpiOf('download_total');
  if (!total?.trend?.length) return null;

  const appByPeriod = new Map((kpiOf('download_app')?.trend || []).map((p) => [p.period, p.value]));
  const pcByPeriod = new Map((kpiOf('download_pc')?.trend || []).map((p) => [p.period, p.value]));

  const periods = (total.trend || [])
    .filter((point) => point.value != null && (!currentKey || point.period <= currentKey))
    // 本期还没走完时，它的累计值只有完整周的零头，画进趋势就是一根假断崖 —— 本期数字在 01 卡和明细里看
    .filter((point) => !(report?.meta?.isPartial && point.period === currentKey))
    .map((point) => point.period)
    .slice(-TREND_WINDOW);

  const points = periods.map((period) => ({
    period,
    label: (total.trend.find((p) => p.period === period) || {}).label || period,
    total: (total.trend.find((p) => p.period === period) || {}).value,
    app: appByPeriod.get(period) ?? null,
    pc: pcByPeriod.get(period) ?? null,
    small: smallGameSeries?.get(period) ?? null,
  }));

  // 「本期」数值与环比用接口给的那一份（含进行中期标记），不用图上最后一个点——
  // 本期没走完时图上不画本期，两者会不是同一期。
  const smallNow = smallGameOf(line);
  // 上一个小游戏有值的期（不含本期）：月度本期未走完时，图上不画本期，但环比仍能和上期比
  const prevWithSmall = [...points].reverse().find((point) => point.small != null && point.period !== currentKey) || null;
  const pick = (key) => {
    const kpi = kpiOf(key);
    return { value: kpi?.value ?? null, deltaPct: kpi?.deltaPct ?? null, comparable: kpi?.deltaComparable };
  };
  const current = {
    total: pick('download_total'),
    app: pick('download_app'),
    pc: pick('download_pc'),
    small: {
      value: smallNow?.value ?? null,
      deltaPct: smallNow && prevWithSmall?.small ? pctChange(smallNow.value, prevWithSmall.small) : null,
      comparable: Boolean(smallNow && prevWithSmall && !report?.meta?.isPartial),
    },
    smallPrev: prevWithSmall?.small ?? null,
    smallPrevPeriod: prevWithSmall?.period ?? null,
  };

  return { points, currentKey, current };
}

/**
 * 03 明细：把「有下载游戏款数」换成「小游戏下载量」。
 * game_cnt 本身不删（覆盖款数那句说明还要用它），只是标记 hidden，不进指标格。
 */
export function withSmallGame(report, trend) {
  if (!report?.lines || !trend?.points?.length) return report;
  const points = trend.points;
  const now = trend.current?.small;
  const hasSmall = now?.value != null;

  return {
    ...report,
    lines: report.lines.map((line) => {
      if (line.key !== 'download') return line;
      const kpis = line.kpis.map((kpi) => (kpi.key === 'game_cnt' ? { ...kpi, hidden: true } : kpi));
      if (!hasSmall) return { ...line, kpis };

      const trendPoints = points
        .filter((point) => point.small != null)
        .map((point) => ({ period: point.period, label: point.label, value: point.small }));
      const small = {
        key: 'small_game_download',
        line: 'download',
        label: '小游戏下载量',
        unit: '次',
        // 本期值取接口当前期的分型（进行中期也算本期），不取趋势最后一个点——两者期次可能不同
        value: now.value,
        prevValue: trend.current?.smallPrev ?? null,
        prevPeriodKey: trend.current?.smallPrevPeriod ?? null,
        deltaAbs: trend.current?.smallPrev != null ? now.value - trend.current.smallPrev : null,
        deltaPct: now.deltaPct ?? null,
        direction: trend.current?.smallPrev != null ? (now.value >= trend.current.smallPrev ? 'up' : 'down') : null,
        deltaComparable: Boolean(now.comparable),
        note: '独立小游戏 + Maker 小游戏；按游戏品类切分，与 APP / PC（按平台）是不同维度，会重叠、不可与它们相加',
        trend: trendPoints,
        availablePeriods: trendPoints.map((point) => point.period),
        historyPoints: trendPoints.length,
        insufficientHistory: trendPoints.length < 3,
        hasValue: true,
      };
      return { ...line, kpis: [...kpis, small] };
    }),
  };
}
