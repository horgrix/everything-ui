/**
 * 下载结构：小游戏品类（独立 / Maker）与逐期趋势
 *
 * 小游戏 = 独立小游戏 + Maker 小游戏（按游戏品类切分），跟 APP / PC（按平台切分）是**两个不同的维度**：
 * 品类三类合计等于下载总量，平台两类也等于下载总量，所以「小游戏」会和 APP/PC 有重叠，
 * 不能把 APP + PC + 小游戏加在一起。页面上只做趋势对照，不做加总，脚注里也照这个说法写。
 *
 * 当期值来自 `/report` 的 `breakdown.items`；逐期值优先读后端的 `breakdown.items[].trend`
 * （`74d1152` 起提供，每个点带 `isPartial`：进行中的半周标 true，画趋势时跳过）。
 * 万一接口没给 trend（老版本），退回按需补拉各期 `/report`——这段是兜底，正常不会执行。
 */
import { useQuery } from '@tanstack/react-query';
import { fetchReport } from '../../api/periodic';

/** 独立小游戏 / Maker 小游戏（以后加新小游戏品类，只要 label 里带「小游戏」就会自动计入「小游戏下载量」） */
const SMALL_GAME_LABEL = /小游戏/;

/** 趋势窗口：跟 02 趋势一致，最多 8 期（含本期） */
export const TREND_WINDOW = 8;

/** 分型 → 图表里的小分类（只认这两类；将来新增的小游戏品类仍会计入「小游戏下载量」合计） */
function categoryOf(label) {
  if (/独立/.test(label)) return 'indie';
  if (/maker/i.test(label)) return 'maker';
  return null;
}

/**
 * 一条业务线当期的小游戏数据：
 *   value / games —— 合计（独立 + Maker）
 *   parts         —— 每个分型各自的当期值与 label，用来单独画「独立小游戏」「Maker 小游戏」两条线
 */
export function smallGameOf(line) {
  const items = (line?.breakdown?.items || []).filter(
    (item) => SMALL_GAME_LABEL.test(item.label || '') && item.value != null
  );
  if (!items.length) return null;
  return {
    value: items.reduce((sum, item) => sum + item.value, 0),
    games: items.reduce((sum, item) => sum + (item.games || 0), 0),
    labels: items.map((item) => item.label),
    parts: items.map((item) => ({
      cat: categoryOf(item.label || ''),
      label: item.label,
      value: item.value,
      games: item.games ?? null,
    })),
  };
}

const emptyCats = () => ({ indie: new Map(), maker: new Map() });

/** 接口若在分型行上给了逐期趋势，直接用它（优先于补拉） */
function smallGameTrendFromApi(line) {
  const items = (line?.breakdown?.items || []).filter((item) => SMALL_GAME_LABEL.test(item.label || ''));
  const withTrend = items.filter((item) => Array.isArray(item.trend) && item.trend.length);
  if (!items.length || withTrend.length !== items.length) return null;

  const merged = new Map();
  const cats = emptyCats();
  withTrend.forEach((item) => {
    const cat = categoryOf(item.label || '');
    item.trend.forEach((point) => {
      if (!point?.period || point.isPartial === true) return; // 进行中的半周不计入趋势
      merged.set(point.period, (merged.get(point.period) || 0) + (point.value || 0));
      if (cat) cats[cat].set(point.period, point.value || 0);
    });
  });
  return merged.size ? { merged, cats } : null;
}

/**
 * 逐期小游戏下载量（合计 + 两个分型各一条）。
 * @returns {{series: Map<string, number>, cats: {indie: Map, maker: Map}, source: string}}
 */
export function useSmallGameSeries(report, periodType, periodKeys) {
  const line = report?.lines?.find((item) => item.key === 'download');
  const fromApi = smallGameTrendFromApi(line);
  const currentKey = report?.meta?.periodKey;
  const need = fromApi ? [] : (periodKeys || []).filter((key) => key && key !== currentKey).slice(-TREND_WINDOW);

  const query = useQuery({
    queryKey: ['pr-small-game', periodType, need.join('|')],
    enabled: need.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const reports = await Promise.all(need.map((key) => fetchReport(periodType, key).catch(() => null)));
      const map = {};
      const cats = { indie: {}, maker: {} };
      need.forEach((key, index) => {
        const items =
          reports[index]?.lines?.find((item) => item.key === 'download')?.breakdown?.items || [];
        const picked = items.filter((item) => SMALL_GAME_LABEL.test(item.label || '') && item.value != null);
        if (!picked.length) return;
        map[key] = picked.reduce((sum, item) => sum + item.value, 0);
        picked.forEach((item) => {
          const cat = categoryOf(item.label || '');
          if (cat) cats[cat][key] = item.value;
        });
      });
      return { map, cats };
    },
  });

  const series = new Map();
  const cats = emptyCats();
  if (fromApi) {
    fromApi.merged.forEach((value, key) => series.set(key, value));
    Object.entries(fromApi.cats).forEach(([cat, map]) => map.forEach((value, key) => cats[cat].set(key, value)));
  } else {
    Object.entries(query.data?.map || {}).forEach(([key, value]) => series.set(key, value));
    Object.entries(query.data?.cats || {}).forEach(([cat, map]) =>
      Object.entries(map).forEach(([key, value]) => cats[cat].set(key, value))
    );
  }

  // 本期（可能还没走完）用 /report 里的分型值，其余期用逐期数据
  const current = smallGameOf(line);
  if (current) {
    series.set(currentKey, current.value);
    (current.parts || []).forEach((part) => {
      if (part.cat) cats[part.cat].set(currentKey, part.value);
    });
  }

  return { series, cats, ready: Boolean(fromApi) || !query.isLoading, source: fromApi ? 'api' : 'report' };
}

function pctChange(value, prev) {
  if (typeof value !== 'number' || typeof prev !== 'number' || !prev) return null;
  return ((value - prev) / prev) * 100;
}

/**
 * 组装下载结构趋势：总量 / APP / PC / 小游戏合计 / 独立小游戏 / Maker 小游戏。
 * 各条曲线长度可能不同（在线类 KPI 只有 3 个点），全部按 period 做 key 合并，不按下标对齐。
 * 进行中的期按接口逐点的 isPartial 剔除，否则末尾是一根假断崖。
 */
export function buildDownloadTrend(report, smallGame) {
  const line = report?.lines?.find((item) => item.key === 'download');
  const currentKey = report?.meta?.periodKey;
  const kpiOf = (key) => line?.kpis?.find((item) => item.key === key);
  const total = kpiOf('download_total');
  if (!total?.trend?.length) return null;

  const appByPeriod = new Map((kpiOf('download_app')?.trend || []).map((p) => [p.period, p.value]));
  const pcByPeriod = new Map((kpiOf('download_pc')?.trend || []).map((p) => [p.period, p.value]));
  const smallSeries = smallGame?.series || new Map();
  const cats = smallGame?.cats || emptyCats();

  const hasPartialFlag = (total.trend || []).some((point) => point.isPartial !== undefined);
  const usable = (total.trend || [])
    .filter((point) => point.value != null)
    .filter((point) =>
      hasPartialFlag
        ? point.isPartial !== true
        : (!currentKey || point.period <= currentKey) && !(report?.meta?.isPartial && point.period === currentKey)
    );
  const periods = usable.map((point) => point.period).slice(-TREND_WINDOW);
  const labelOf = new Map(usable.map((point) => [point.period, point.label || point.period]));
  const totalOf = new Map(usable.map((point) => [point.period, point.value]));

  const points = periods.map((period) => ({
    period,
    label: labelOf.get(period) || period,
    total: totalOf.get(period) ?? null,
    app: appByPeriod.get(period) ?? null,
    pc: pcByPeriod.get(period) ?? null,
    small: smallSeries.get(period) ?? null,
    indie: cats.indie.get(period) ?? null,
    maker: cats.maker.get(period) ?? null,
  }));

  // 「本期」数值与环比用接口给的那一份（含进行中期标记），不用图上最后一个点——
  // 本期没走完时图上不画本期，两者会不是同一期。
  const now = smallGameOf(line);
  const lastWith = (map) => {
    for (let i = points.length - 1; i >= 0; i -= 1) {
      const value = map.get(points[i].period);
      if (typeof value === 'number' && points[i].period !== currentKey) return { value, period: points[i].period };
    }
    return null;
  };
  const partial = report?.meta?.isPartial === true;
  const pick = (key) => {
    const kpi = kpiOf(key);
    return {
      value: kpi?.value ?? null,
      deltaPct: kpi?.deltaPct ?? null,
      comparable: kpi?.deltaComparable,
      blocked: kpi?.deltaBlocked ?? (partial ? 'current_in_progress' : null),
    };
  };
  const partNow = (cat) => (now?.parts || []).find((part) => part.cat === cat)?.value ?? null;
  const partCard = (cat) => {
    const value = partNow(cat);
    const prev = lastWith(cats[cat]);
    const canCompare = Boolean(value != null && prev && !partial);
    return {
      value,
      // 自己算的环比同样要守规矩：本期没走完时不给数字，只给原因
      deltaPct: canCompare ? pctChange(value, prev.value) : null,
      comparable: canCompare,
      blocked: partial ? 'current_in_progress' : null,
      prevValue: prev?.value ?? null,
      prevPeriod: prev?.period ?? null,
    };
  };
  const prevSmall = lastWith(smallSeries);
  const current = {
    total: pick('download_total'),
    app: pick('download_app'),
    pc: pick('download_pc'),
    small: (() => {
      const canCompare = Boolean(now && prevSmall && !partial);
      return {
        value: now?.value ?? null,
        deltaPct: canCompare ? pctChange(now.value, prevSmall.value) : null,
        comparable: canCompare,
        blocked: partial ? 'current_in_progress' : null,
        prevValue: prevSmall?.value ?? null,
        prevPeriod: prevSmall?.period ?? null,
      };
    })(),
    indie: partCard('indie'),
    maker: partCard('maker'),
  };

  return { points, currentKey, current };
}

/**
 * 04 明细：把「有下载游戏款数」换成「小游戏下载量」。
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
        prevValue: now.prevValue ?? null,
        prevPeriodKey: now.prevPeriod ?? null,
        deltaAbs: now.prevValue != null ? now.value - now.prevValue : null,
        deltaPct: now.deltaPct ?? null,
        direction: now.prevValue != null ? (now.value >= now.prevValue ? 'up' : 'down') : null,
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
