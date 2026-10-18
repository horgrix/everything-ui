import { useState, useMemo } from 'react';
import useChartData from '../../hooks/useChartData';
import query from '../../api/query';
import LineChart from '../../components/charts/LineChart';
import HeatmapChart from '../../components/charts/HeatmapChart';
import BarChart from '../../components/charts/BarChart';
import MixedChart from '../../components/charts/MixedChart';
import BrushLineChart from '../../components/charts/BrushLineChart';
import DashboardCard from '../../components/layout/DashboardCard';
import { formatCompactNumber, formatNumber } from '../../utils/formatters';
import { AD_MATERIAL_COLORS } from '../../utils/chart-theme';

const TABLE_NAME = 'steam_best_seller_list_hourly';
const WEEKLY_TABLE_NAME = 'steam_best_seller_list_weekly';

/**
 * 大盘游戏配置。
 * 火炬之光的「国际服 / 国服」是两个 Steam 版本，已合并为一个入口；
 * servers 的顺序即展示顺序（国际服在上、国服在下）。
 */
/** 火炬之光赛季表「历史最高」KPI 定义（顺序即展示顺序） */
const SEASON_KPI_FIELDS = [
  { key: 'peak', label: '历史最高在线人数', field: 'peak_players', icon: 'bi-people', color: 'primary' },
  { key: 'steam', label: '历史Steam最高在线人数', field: 'steam_peak_players', icon: 'bi-steam', color: 'info' },
  { key: 'steamGlobal', label: '历史Steam国际服最高在线人数', field: 'steam_1974050_peak_players', icon: 'bi-globe', color: 'success' },
  { key: 'steamCn', label: '历史Steam国服最高在线人数', field: 'steam_2315040_peak_players', icon: 'bi-globe2', color: 'warning' },
  { key: 'tappc', label: '历史TapPC最高在线人数', field: 'tappc_peak_players', icon: 'bi-pc-display', color: 'secondary' },
];

/** 心动小镇日表「历史最高」KPI 定义（顺序即展示顺序） */
const HEARTOPIA_KPI_FIELDS = [
  { key: 'peak', label: '历史最高在线人数', field: 'peak_players', icon: 'bi-people', color: 'primary' },
  { key: 'steam', label: '历史Steam最高在线人数', field: 'steam_peak_players', icon: 'bi-steam', color: 'info' },
  { key: 'tappc', label: '历史TapPC最高在线人数', field: 'tappc_peak_players', icon: 'bi-pc-display', color: 'secondary' },
];

const STEAM_GAMES = {
  torchlight: {
    name: '火炬之光: 无限',
    /** 【全平台】在线/峰值趋势的多个数据源（仅该游戏有） */
    onlineTrend: {
      appName: '火炬之光：无限',
      hourlyTable: 'dws_games_torchlight_online_players_hourly',
      /** 堆叠柱系列（顺序即图例顺序） */
      series: [
        { name: 'TapPC国服', field: 'tappc_online_players', color: '#C4A4A4' },
        { name: 'Steam国际服', field: 'steam_1974050_online_players', color: '#7A8B99' },
        { name: 'Steam国服', field: 'steam_2315040_online_players', color: '#9CAF9F' },
      ],
      dailyTable: 'dws_games_torchlight_online_players_daily',
      monthlyTable: 'dws_games_torchlight_online_players_monthly',
    },
    /** 【全平台】赛季日在线人数对比的数据源（仅该游戏有） */
    seasonCompare: { table: 'dws_games_torchlight_season_online_players' },
    /** 趋势上方的「历史最高」KPI（时间节点用赛季定位） */
    kpi: {
      table: 'dws_games_torchlight_season_online_players',
      fields: SEASON_KPI_FIELDS,
      extraFields: ['ss', 'ss_day'],
      subtitle: (r) => `第${r.ss}赛季第${r.ss_day}天`,
    },
    /** 【全平台】游戏下载日趋势（堆叠柱，最近 N 天） */
    downloadTrend: {
      table: 'dws_xd_games_all_download_daily',
      appName: '火炬之光：无限',
      days: 7,
      series: [
        { name: 'TapPC', field: 'tap_pc_download_count', color: '#7A8B99' },
        { name: 'TapApp', field: 'tap_app_download_count', color: '#9CAF9F' },
        { name: 'iPhone', field: 'iphone_cn_download_count', color: '#C4A4A4' },
        { name: 'iPad', field: 'ipad_cn_download_count', color: '#D6C9B0' },
      ],
    },
    /** 【TapTap】/【iOS】赛季日下载数对比 */
    seasonDownload: { table: 'dws_games_torchlight_season_download', minSs: 11 },
    servers: [
      { key: 'global', label: '国际服', steamId: '1974050' },
      { key: 'cn', label: '国服', steamId: '2315040' },
    ],
  },
  heartopia: {
    name: '心动小镇',
    /** 【全平台】在线/峰值趋势（心动小镇小时表只按 Steam / TapPC 两档拆分） */
    onlineTrend: {
      hourlyTable: 'dws_games_heartopia_online_players_hourly',
      series: [
        { name: 'TapPC', field: 'tappc_online_players', color: '#C4A4A4' },
        { name: 'Steam', field: 'steam_online_players', color: '#7A8B99' },
      ],
      dailyTable: 'dws_games_heartopia_online_players_daily',
      monthlyTable: 'dws_games_heartopia_online_players_monthly',
    },
    /** 趋势上方的「历史最高」KPI（时间节点用该日数据日期） */
    kpi: {
      table: 'dws_games_heartopia_online_players_daily',
      fields: HEARTOPIA_KPI_FIELDS,
      subtitle: (r) => r.crawled_at,
    },
    /** 【全平台】游戏下载日趋势（与火炬之光同源表，按 app_name 区分） */
    downloadTrend: {
      table: 'dws_xd_games_all_download_daily',
      appName: '心动小镇',
      days: 7,
      series: [
        { name: 'TapPC', field: 'tap_pc_download_count', color: '#7A8B99' },
        { name: 'TapApp', field: 'tap_app_download_count', color: '#9CAF9F' },
        { name: 'iPhone', field: 'iphone_cn_download_count', color: '#C4A4A4' },
        { name: 'iPad', field: 'ipad_cn_download_count', color: '#D6C9B0' },
      ],
    },
    /** 【iOS】畅销榜排名趋势 */
    bestSeller: { table: 'ios_xd_games_best_sellers_daily', appName: '心动小镇' },
    servers: [{ key: 'global', label: '国际服', steamId: '4025700' }],
  },
};

const GAME_KEYS = Object.keys(STEAM_GAMES);

/** 排名趋势折线配色（地区数不定，按色库循环） */
const TREND_COLORS = AD_MATERIAL_COLORS;

/** 排名热力图色阶（top10 最深 → top100 最深，中间最浅；取自色库） */
const HEATMAP_RANGES = [
  { from: 1, to: 10, name: 'top10', color: '#5C6B7A' },
  { from: 11, to: 20, name: 'top20', color: '#6B7C8C' },
  { from: 21, to: 30, name: 'top30', color: '#7A8B99' },
  { from: 31, to: 40, name: 'top40', color: '#A9BAC4' },
  { from: 41, to: 50, name: 'top50', color: '#D8CFC0' },
  { from: 51, to: 60, name: 'top60', color: '#C9B79C' },
  { from: 61, to: 70, name: 'top70', color: '#BFAE8E' },
  { from: 71, to: 80, name: 'top80', color: '#A6947E' },
  { from: 81, to: 90, name: 'top90', color: '#8A8F6B' },
  { from: 91, to: 100, name: 'top100', color: '#5F6F5E' },
];

/** 峰值/平均趋势配色（柱=峰值，线=平均；取自色库） */
const PEAK_TREND_COLORS = ['#7A8B99', '#C4A4A4'];

/** 最近 N 小时（withSeconds=true 输出 'YYYY-MM-DD HH:MM:SS'，false 输出 'YYYY-MM-DD HH'） */
function recentHoursWhere(hours = 24, withSeconds = true) {
  const start = new Date(Date.now() - hours * 3600000);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  const d = String(start.getDate()).padStart(2, '0');
  const h = String(start.getHours()).padStart(2, '0');
  return [{ col: 'crawled_at', op: '>=', value: withSeconds ? `${y}-${m}-${d} ${h}:00:00` : `${y}-${m}-${d} ${h}` }];
}

/** 最近 N 天（日期边界；兼容 crawled_at 的 'YYYY-MM-DD' 与 'YYYY-MM-DD HH' 两种格式） */
function recentDaysWhere(days = 7) {
  const start = new Date(Date.now() - days * 86400000);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  const d = String(start.getDate()).padStart(2, '0');
  return [{ col: 'crawled_at', op: '>=', value: `${y}-${m}-${d}` }];
}

/** 最近 N 个月（从 N 个月前的 1 号起） */
function recentMonthsWhere(months = 3) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - months, 1);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  return [{ col: 'crawled_at', op: '>=', value: `${y}-${m}-01` }];
}

/** 排名趋势（按 region 分组的折线数据） */
function transformTrend(rows) {
  if (!rows || rows.length === 0) return { series: [] };
  const groups = {};
  for (const row of rows) {
    const key = row.region || 'unknown';
    if (!groups[key]) groups[key] = [];
    const ts = row.crawled_at;
    groups[key].push({
      x: ts.includes(':') ? ts : ts + ':00',
      y: Number(row.rank),
    });
  }
  return {
    series: Object.entries(groups).map(([name, data]) => ({ name, data })),
  };
}

/** 周热销榜（行=region，列=日期，值=排名；缺失日期填 null） */
function transformHeatmap(rows) {
  if (!rows || rows.length === 0) return { series: [], categories: [] };

  // 1) 收集所有唯一日期并排序
  const dateSet = new Set();
  for (const r of rows) {
    dateSet.add(String(r.crawled_at).slice(0, 10));
  }
  const categories = Array.from(dateSet).sort();

  // 2) 按 region 收集原始数据，做快速查找 map
  const rawMap = {};
  for (const r of rows) {
    const region = r.region || 'unknown';
    const date = String(r.crawled_at).slice(0, 10);
    const key = `${region}||${date}`;
    if (!rawMap[key]) rawMap[key] = Number(r.rank);
  }
  const regions = [...new Set(Object.keys(rawMap).map((k) => k.split('||')[0]))];

  // 3) 为每个 region 生成统一对齐的数据（缺失日期填 null）
  const series = regions.map((region) => ({
    name: region,
    data: categories.map((date) => ({
      x: date,
      y: rawMap[`${region}||${date}`] ?? null,
    })),
  }));

  return { series, categories };
}

/**
 * 【全平台】在线人数趋势（最近24小时，堆叠柱；x=小时，y=在线人数）。
 * 数据源为游戏级小时表，crawled_at 格式为 'YYYY-MM-DD HH'。
 */
function PlatformOnlineTrend({ table, appName, series: seriesDefs }) {
  const where = useMemo(
    () => [...recentHoursWhere(24, false), ...(appName ? [{ col: 'app_name', op: '=', value: appName }] : [])],
    [appName]
  );
  const fields = useMemo(
    () => ['crawled_at', ...(seriesDefs || []).map((d) => d.field)].join(','),
    [seriesDefs]
  );

  const trendQuery = useChartData(
    `games-online-trend-${table}`,
    (p) => query(table, p),
    {
      fields,
      where,
      order_by: 'crawled_at ASC',
      limit: 9999,
    },
    {
      transform: (rows) => {
        if (!rows || rows.length === 0) return { series: [], categories: [] };
        const sorted = [...rows].sort((a, b) => (a.crawled_at < b.crawled_at ? -1 : 1));
        const categories = sorted.map((r) => r.crawled_at);
        return {
          categories,
          series: (seriesDefs || []).map((d) => ({
            name: d.name,
            data: sorted.map((r) => Number(r[d.field] || 0)),
          })),
        };
      },
    }
  );

  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-header bg-white border-0 fw-semibold">
        【全平台】在线人数趋势 — 最近24小时
      </div>
      <div className="card-body">
        <BarChart
          series={trendQuery.data?.series || []}
          loading={trendQuery.isLoading}
          error={trendQuery.error?.message}
          height={700}
          stacked
          totalLabels
          shared
          colors={(seriesDefs || []).map((d, i) => d.color || AD_MATERIAL_COLORS[i % AD_MATERIAL_COLORS.length])}
          toolbar={false}
          xaxisOverrides={trendQuery.data?.categories ? { categories: trendQuery.data.categories, labels: { rotate: -45 } } : {}}
          yaxisOverrides={{ title: { text: '在线人数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
        />
      </div>
    </div>
  );
}

/**
 * 【全平台】峰值在线人数日/月趋势（混合图：左轴柱=峰值，右轴线=平均，右轴取整）。
 */
function PeakTrendCard({ title, table, days = null, height = 240 }) {
  const where = useMemo(() => (days ? recentDaysWhere(days) : null), [days]);

  const trendQuery = useChartData(
    `games-peak-trend-${table}-${days || 'all'}`,
    (p) => query(table, p),
    {
      fields: 'crawled_at,peak_players,avg_players',
      order_by: 'crawled_at ASC',
      limit: 9999,
      ...(where ? { where } : {}),
    },
    {
      transform: (rows) => {
        if (!rows || rows.length === 0) return { series: [], categories: [] };
        const sorted = [...rows].sort((a, b) => (a.crawled_at < b.crawled_at ? -1 : 1));
        const num = (v) => (v == null ? null : Number(v));
        return {
          categories: sorted.map((r) => r.crawled_at),
          series: [
            { name: '峰值在线', type: 'column', yAxisIndex: 0, data: sorted.map((r) => num(r.peak_players)) },
            { name: '平均在线', type: 'line', yAxisIndex: 1, data: sorted.map((r) => num(r.avg_players)) },
          ],
        };
      },
    }
  );

  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-header bg-white border-0 fw-semibold">{title}</div>
      <div className="card-body">
        <MixedChart
          series={trendQuery.data?.series || []}
          loading={trendQuery.isLoading}
          error={trendQuery.error?.message}
          height={height}
          colors={PEAK_TREND_COLORS}
          strokeWidths={[0, 2]}
          toolbar={false}
          tooltipY={(v, yi) => (yi === 1 ? Math.round(v) : formatCompactNumber(v))}
          xaxisOverrides={trendQuery.data?.categories ? { categories: trendQuery.data.categories, labels: { rotate: -45 } } : {}}
          yaxisLeft={{ title: { text: '峰值在线' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
          yaxisRight={{ title: { text: '平均在线' }, min: 0, labels: { formatter: (v) => Math.round(v) } }}
        />
      </div>
    </div>
  );
}

/**
 * 通用「历史最高」KPI 行：从指定表里取各字段的最大值及其发生的那一行。
 * @param {string} table 数据表
 * @param {Array} fields [{ key, label, field, icon, color }]
 * @param {Array<string>} [extraFields] 除字段外额外需要取回的列（供 subtitle 使用）
 * @param {(row) => string} [subtitle] 用命中的那一行生成「统计时间」副标题
 */
function MaxKpiRow({ table, fields, extraFields = [], subtitle = null }) {
  const kpiQuery = useChartData(
    `games-max-kpi-${table}`,
    (p) => query(table, p),
    {
      fields: ['crawled_at', ...extraFields, ...fields.map((f) => f.field)].join(','),
      limit: 9999,
    },
    {
      transform: (rows) => {
        if (!rows || rows.length === 0) return [];
        return fields.map((f) => {
          let best = null;
          for (const r of rows) {
            const v = r[f.field] == null ? null : Number(r[f.field]);
            if (v == null || Number.isNaN(v)) continue;
            if (!best || v > best.value) best = { value: v, row: r };
          }
          return {
            key: f.key,
            label: f.label,
            icon: f.icon,
            color: f.color,
            value: best ? best.value : null,
            subtitle: best && subtitle ? subtitle(best.row) : '',
          };
        });
      },
    }
  );

  if (kpiQuery.isLoading || kpiQuery.error) {
    return null;
  }

  const items = (kpiQuery.data || []).filter((k) => k.value != null);
  if (!items.length) return null;

  return (
    <div className="row g-3 mb-4">
      {items.map((k) => (
        <div className="col-12 col-sm-6 col-lg" key={k.key}>
          <DashboardCard
            title={k.label}
            value={formatNumber(k.value)}
            subtitle={k.subtitle || ''}
            icon={k.icon}
            color={k.color}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * 【全平台】游戏下载日趋势（堆叠柱；x=日期，y=下载量）。
 */
function DownloadTrendCard({ table, appName = null, series: seriesDefs, days = 7, height = 600 }) {
  const where = useMemo(
    () => [...recentDaysWhere(days), ...(appName ? [{ col: 'app_name', op: '=', value: appName }] : [])],
    [days, appName]
  );
  const fields = useMemo(
    () => ['crawled_at', ...(seriesDefs || []).map((d) => d.field)].join(','),
    [seriesDefs]
  );

  const trendQuery = useChartData(
    `games-download-trend-${table}-${days}-${appName || 'all'}`,
    (p) => query(table, p),
    { fields, where, order_by: 'crawled_at ASC', limit: 9999 },
    {
      transform: (rows) => {
        if (!rows || rows.length === 0) return { series: [], categories: [] };
        // 同一 crawled_at 下可能有多行（赛季×天明细），按 crawled_at 汇总求和
        const num = (v) => (v == null ? 0 : Number(v));
        const byDay = {};
        const daySet = new Set();
        for (const r of rows) {
          const day = r.crawled_at;
          daySet.add(day);
          if (!byDay[day]) byDay[day] = {};
          (seriesDefs || []).forEach((d) => {
            byDay[day][d.field] = (byDay[day][d.field] || 0) + num(r[d.field]);
          });
        }
        const categories = [...daySet].sort();
        return {
          categories,
          series: (seriesDefs || []).map((d) => ({
            name: d.name,
            data: categories.map((day) => byDay[day][d.field] || 0),
          })),
        };
      },
    }
  );

  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-header bg-white border-0 fw-semibold">
        【全平台】游戏下载日趋势 — 最近{days}天
      </div>
      <div className="card-body">
        <BarChart
          series={trendQuery.data?.series || []}
          loading={trendQuery.isLoading}
          error={trendQuery.error?.message}
          height={height}
          stacked
          totalLabels
          shared
          toolbar={false}
          colors={(seriesDefs || []).map((d, i) => d.color || AD_MATERIAL_COLORS[i % AD_MATERIAL_COLORS.length])}
          xaxisOverrides={trendQuery.data?.categories ? { categories: trendQuery.data.categories, labels: { rotate: -45 } } : {}}
          yaxisOverrides={{ title: { text: '下载量' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
        />
      </div>
    </div>
  );
}

/**
 * 赛季日下载数对比的数据（一次查询，两张图共用）。
 * 输出 { seasons: [{ ss, points: [{ ssDay, tap_download_count, ios_cn_download_count }] }] }
 */
function useSeasonDownloadData(table, minSs = null) {
  // ss 下限（用于排除不完整的历史赛季）
  const where = useMemo(() => (minSs != null ? [{ col: 'ss', op: '>=', value: minSs }] : []), [minSs]);

  return useChartData(
    `games-season-download-${table}-ss${minSs ?? 'all'}`,
    (p) => query(table, p),
    {
      fields: 'ss,ss_day,tap_download_count,ios_cn_download_count',
      ...(where.length ? { where } : {}),
      order_by: 'ss ASC, ss_day ASC',
      limit: 9999,
    },
    {
      transform: (rows) => {
        if (!rows || rows.length === 0) return { seasons: [] };
        const num = (v) => (v == null ? null : Number(v));
        const sorted = [...rows].sort((a, b) => (Number(a.ss) - Number(b.ss)) || (Number(a.ss_day) - Number(b.ss_day)));
        const groups = {};
        for (const r of sorted) {
          const ss = Number(r.ss);
          if (!groups[ss]) groups[ss] = [];
          groups[ss].push({
            ssDay: Number(r.ss_day),
            tap_download_count: num(r.tap_download_count),
            ios_cn_download_count: num(r.ios_cn_download_count),
            // 全渠道 = TapTap + iOS（两者都无数据时为 null）
            all_download_count:
              num(r.tap_download_count) == null && num(r.ios_cn_download_count) == null
                ? null
                : (num(r.tap_download_count) || 0) + (num(r.ios_cn_download_count) || 0),
          });
        }
        return {
          seasons: Object.keys(groups)
            .map(Number)
            .sort((a, b) => a - b)
            .map((ss) => ({ ss, points: groups[ss] })),
        };
      },
    }
  );
}

/** 单张赛季下载数对比卡（双轴折线；每个赛季生成一条左轴均值注解） */
function SeasonDownloadCard({ title, field, seasons, height = 450, annotationAxis = 1, xMin = 1, xMax = 91 }) {
  const series = buildSeasonSeries(seasons || [], field);
  const currentSs = seasons && seasons.length ? seasons[seasons.length - 1].ss : null;

  const seasonMeans = series
    .map((s, i) => {
      const vals = s.data.map((d) => d.y).filter((v) => v != null && Number.isFinite(v));
      if (!vals.length) return null;
      return { name: s.name, mean: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), colorIndex: i };
    })
    .filter(Boolean);

  // 右 Y 轴：0 ~ 赛季下载均数最大值的 1.5 倍
  const rightMax = seasonMeans.length ? Math.round(Math.max(...seasonMeans.map((m) => m.mean)) * 1.5) : null;

  // 每个赛季一条均值注解，标签居中；annotationAxis=1 绑右轴，0 绑左轴
  const annotations = seasonMeans.map((m) => ({
    y: m.mean,
    yAxisIndex: annotationAxis,
    color: AD_MATERIAL_COLORS[m.colorIndex % AD_MATERIAL_COLORS.length],
    dash: 2,
    position: 'center',
    label: `${m.name}均值：${formatCompactNumber(m.mean)}`,
  }));

  // 注解绑右轴时，ApexCharts 需要右轴上有 series 才能定位 → 挂一个透明、零线宽、无名称的锚点系列
  // （左轴本身有真实系列，无需锚点）
  const needAnchor = annotationAxis === 1;
  const chartSeries = needAnchor
    ? [...series, { name: '', type: 'line', data: [{ x: 1, y: 0 }, { x: 91, y: 0 }] }]
    : series;
  const chartColors = needAnchor
    ? [...series.map((_, i) => AD_MATERIAL_COLORS[i % AD_MATERIAL_COLORS.length]), 'transparent']
    : AD_MATERIAL_COLORS;
  const chartStrokeWidths = series.length
    ? [...series.map((s) => (s.isCurrent ? 4 : 2)), ...(needAnchor ? [0] : [])]
    : 2;
  const chartDashArrays = series.length
    ? [...series.map((s) => (s.isCurrent ? 0 : 5)), ...(needAnchor ? [0] : [])]
    : null;

  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-header bg-white border-0 fw-semibold">
        {title}
        <div className="text-muted small fw-normal">
          当赛季{currentSs != null ? `（第${currentSs}赛季）` : ''}实线加粗，其余赛季虚线
        </div>
      </div>
      <div className="card-body">
        <LineChart
          series={chartSeries}
          height={height}
          colors={chartColors}
          strokeWidth={series.length ? chartStrokeWidths : 2}
          strokeDashArray={series.length ? chartDashArrays : null}
          shared
          tooltipCustom={seasonTooltip}
          toolbar={false}
          legendOverrides={{ floating: true, position: 'top', horizontalAlign: 'center', fontSize: '10px', offsetY: 6 }}
          xaxisOverrides={{ type: 'numeric', min: xMin, max: xMax, title: { text: '赛季天数' }, labels: { formatter: (v) => String(Math.round(v)) } }}
          yaxisOverrides={{ seriesName: series.map((s) => s.name), title: { text: '下载数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
          yaxisRight={{ min: 0, ...(rightMax != null ? { max: rightMax } : {}), ...(needAnchor ? { seriesName: [''] } : {}), labels: { formatter: (v) => formatCompactNumber(v) } }}
          yaxisAnnotations={annotations}
        />
      </div>
    </div>
  );
}

/** 赛季下载区域：【TapTap】/【iOS】并排各 50% */
function SeasonDownloadSection({ table, minSs }) {
  const seasonQuery = useSeasonDownloadData(table, minSs);
  const seasons = seasonQuery.data?.seasons || [];

  if (seasonQuery.isLoading || seasonQuery.error) return null;

  return (
    <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <SeasonDownloadCard title="【TapTap】赛季日下载数对比" field="tap_download_count" seasons={seasons} xMin={0} xMax={90} />
      </div>
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <SeasonDownloadCard title="【iOS】赛季日下载数对比" field="ios_cn_download_count" seasons={seasons} xMin={0} xMax={90} />
      </div>
    </div>
  );
}

/** 下载区：游戏下载日趋势 35% + 全渠道赛季日下载数对比 65% */
function DownloadSection({ trendConfig, seasonConfig }) {
  const seasonQuery = useSeasonDownloadData(seasonConfig.table, seasonConfig.minSs);
  const seasons = seasonQuery.data?.seasons || [];

  return (
    <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
      <div style={{ flex: '35 1 0', minWidth: 0 }}>
        <DownloadTrendCard table={trendConfig.table} appName={trendConfig.appName} series={trendConfig.series} days={trendConfig.days} />
      </div>
      <div style={{ flex: '65 1 0', minWidth: 0 }}>
        <SeasonDownloadCard
          title="【全渠道】赛季日下载数对比"
          field="all_download_count"
          seasons={seasons}
          height={600}
          xMin={0}
          xMax={90}
        />
      </div>
    </div>
  );
}

/**
 * 【iOS】畅销榜排名趋势（Brush 折线：总榜 overall_rank / 游戏榜 games_rank）。
 */
function BestSellerCard({ table, appName }) {
  const where = useMemo(() => [{ col: 'app_name', op: '=', value: appName }], [appName]);

  const rankQuery = useChartData(
    `ios-best-seller-${table}-${appName}`,
    (p) => query(table, p),
    { fields: 'stat_date,overall_rank,games_rank', where, order_by: 'stat_date ASC', limit: 9999 },
    {
      transform: (rows) => {
        if (!rows || rows.length === 0) return { series: [], selection: null };
        const num = (v) => (v === '' || v == null ? null : Number(v));
        const toX = (d) => new Date(`${String(d).slice(0, 10)}T00:00:00`).getTime();
        const sorted = [...rows].sort((a, b) => (a.stat_date < b.stat_date ? -1 : 1));
        // 刷选条默认只选中「最近 30 天」的数据（以数据里最后一天为基准，不依赖今天）
        const lastX = toX(sorted[sorted.length - 1].stat_date);
        const firstX = toX(sorted[0].stat_date);
        const selMin = Math.max(firstX, lastX - 30 * 86400000);
        return {
          series: [
            { name: '总榜', data: sorted.map((r) => ({ x: toX(r.stat_date), y: num(r.overall_rank) })) },
            { name: '游戏榜', data: sorted.map((r) => ({ x: toX(r.stat_date), y: num(r.games_rank) })) },
          ],
          selection: { min: selMin, max: lastX },
        };
      },
    }
  );

  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-header bg-white border-0 fw-semibold">
        【iOS】畅销榜排名趋势
        <div className="text-muted small fw-normal">拖动下方刷选条可缩放时间范围</div>
      </div>
      <div className="card-body">
        <BrushLineChart
          id={`best-seller-${appName}`}
          series={rankQuery.data?.series || []}
          brushSelection={rankQuery.data?.selection || null}
          loading={rankQuery.isLoading}
          error={rankQuery.error?.message}
          height={500}
          brushHeight={80}
          colors={['#7A8B99', '#C4A4A4']}
          strokeWidth={2}
          xaxisOverrides={{ labels: { format: 'MM/dd', datetimeUTC: false, rotate: -45 } }}
          yaxisOverrides={{ title: { text: '排名' }, reversed: true, labels: { formatter: (v) => Math.round(v) } }}
          legendOverrides={{ floating: true, position: 'top', horizontalAlign: 'center', fontSize: '10px', offsetY: 6 }}
        />
      </div>
    </div>
  );
}

/** 在线/峰值区域：在线人数趋势 65%，右侧两图 35%（上下各占一半高度） */
function OnlineSection({ config }) {
  return (
    <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
      <div style={{ flex: '65 1 0', minWidth: 0 }}>
        <PlatformOnlineTrend table={config.hourlyTable} appName={config.appName} series={config.series} />
      </div>
      <div className="d-flex flex-column gap-3" style={{ flex: '35 1 0', minWidth: 0 }}>
        <div style={{ flex: '1 1 0', minHeight: 0 }}>
          <PeakTrendCard title="【全平台】峰值在线人数日趋势 — 最近7天" table={config.dailyTable} days={7} />
        </div>
        <div style={{ flex: '1 1 0', minHeight: 0 }}>
          <PeakTrendCard title="【全平台】峰值在线人数月趋势" table={config.monthlyTable} />
        </div>
      </div>
    </div>
  );
}

/**
 * 赛季日在线人数对比的数据（一次查询，三张图共用）。
 * 输出 { seasons: [{ ss, points: [{ ssDay, peak_players, steam_peak_players, tappc_peak_players }] }] }
 */
function useSeasonData(table) {
  return useChartData(
    `games-season-online-${table}`,
    (p) => query(table, p),
    {
      fields: 'ss,ss_day,peak_players,steam_peak_players,tappc_peak_players',
      order_by: 'ss ASC, ss_day ASC',
      limit: 9999,
    },
    {
      transform: (rows) => {
        if (!rows || rows.length === 0) return { seasons: [] };
        const sorted = [...rows].sort((a, b) => (Number(a.ss) - Number(b.ss)) || (Number(a.ss_day) - Number(b.ss_day)));
        const num = (v) => (v == null ? null : Number(v));
        const groups = {};
        for (const r of sorted) {
          const ss = Number(r.ss);
          if (!groups[ss]) groups[ss] = [];
          groups[ss].push({
            ssDay: Number(r.ss_day),
            peak_players: num(r.peak_players),
            steam_peak_players: num(r.steam_peak_players),
            tappc_peak_players: num(r.tappc_peak_players),
          });
        }
        return {
          seasons: Object.keys(groups)
            .map(Number)
            .sort((a, b) => a - b)
            .map((ss) => ({ ss, points: groups[ss] })),
        };
      },
    }
  );
}

/** 取每个赛季在指定指标上的折线数据；当赛季 = 最大赛季号 */
function buildSeasonSeries(seasons, field) {
  const currentSs = seasons.length ? seasons[seasons.length - 1].ss : null;
  return seasons.map((s) => ({
    name: `第${s.ss}赛季`,
    isCurrent: s.ss === currentSs,
    data: s.points.map((p) => ({ x: p.ssDay, y: p[field] })),
  }));
}

/**
 * 赛季对比图的合并 tooltip：按同一个「赛季第N天」把**所有赛季**的值列出来。
 * （默认的 shared tooltip 依赖各系列 x 对齐，赛季长度不一就会漏值）
 */
function seasonTooltip({ seriesIndex, dataPointIndex, w }) {
  const cfgSeries = (w.config.series || []).filter((s) => s.name);
  const hovered = cfgSeries[seriesIndex]?.data?.[dataPointIndex] || cfgSeries[0]?.data?.[dataPointIndex];
  if (!hovered) return '';
  const day = hovered.x;
  const colors = w.config.colors || [];
  const items = cfgSeries
    .map((s) => {
      const pt = (s.data || []).find((d) => Number(d.x) === Number(day));
      const val = pt && pt.y != null ? formatCompactNumber(pt.y) : '-';
      const idx = (w.config.series || []).indexOf(s);
      const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colors[idx] || '#999'};margin-right:6px"></span>`;
      return `<div style="display:flex;align-items:center;gap:12px;justify-content:space-between"><span>${dot}${s.name}</span><b>${val}</b></div>`;
    })
    .join('');
  return `<div style="padding:6px 12px;font-size:12px;line-height:1.7;min-width:130px"><div style="opacity:.75;margin-bottom:4px">赛季第 ${Math.round(day)} 天</div>${items}</div>`;
}

/** 单张赛季对比折线卡片（供整行 / 并排复用） */
function SeasonCompareCard({ title, field, seasons, loading, error }) {
  const series = buildSeasonSeries(seasons || [], field);
  const currentSs = seasons && seasons.length ? seasons[seasons.length - 1].ss : null;

  // 各赛季均值（右 Y 轴注解）
  const seasonMeans = series
    .map((s, i) => {
      const vals = s.data.map((d) => d.y).filter((v) => v != null && Number.isFinite(v));
      if (!vals.length) return null;
      return { name: s.name, mean: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), colorIndex: i };
    })
    .filter(Boolean);

  // 右 Y 轴固定为 0 ~ 赛季均值最大值的 1.5 倍
  const rightMax = seasonMeans.length ? Math.round(Math.max(...seasonMeans.map((m) => m.mean)) * 1.5) : null;

  const annotations = seasonMeans.map((m) => ({
    y: m.mean,
    yAxisIndex: 1,
    color: AD_MATERIAL_COLORS[m.colorIndex % AD_MATERIAL_COLORS.length],
    dash: 2,
    position: 'right',
    label: `${m.name}均值：${formatCompactNumber(m.mean)}`,
  }));

  // 右轴必须挂一个 series 才能承载注解定位（ApexCharts 注解的像素位置取自该轴上 series 的 min/range）；
  // 这里挂一个透明、零线宽、无名称的锚点系列，视觉上不可见，也不进图例文字/合并 tooltip。
  const chartSeries = [...series, { name: '', type: 'line', data: [{ x: 0, y: 0 }, { x: 90, y: 0 }] }];
  const chartColors = [...series.map((_, i) => AD_MATERIAL_COLORS[i % AD_MATERIAL_COLORS.length]), 'transparent'];
  const chartStrokeWidths = [...series.map((s) => (s.isCurrent ? 4 : 2)), 0];
  const chartDashArrays = [...series.map((s) => (s.isCurrent ? 0 : 5)), 0];

  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-header bg-white border-0 fw-semibold">
        {title}
        <div className="text-muted small fw-normal">
          当赛季{currentSs != null ? `（第${currentSs}赛季）` : ''}实线加粗，其余赛季虚线
        </div>
      </div>
      <div className="card-body">
        <LineChart
          series={chartSeries}
          loading={loading}
          error={error}
          height={500}
          colors={chartColors}
          strokeWidth={chartSeries.length ? chartStrokeWidths : 2}
          strokeDashArray={chartSeries.length ? chartDashArrays : null}
          shared
          tooltipCustom={seasonTooltip}
          toolbar={false}
          legendOverrides={{ floating: true, position: 'top', horizontalAlign: 'center', fontSize: '10px', offsetY: 6 }}
          xaxisOverrides={{ type: 'numeric', min: 0, max: 90, title: { text: '赛季天数' }, labels: { formatter: (v) => String(Math.round(v)) } }}
          yaxisOverrides={{ seriesName: series.map((s) => s.name), title: { text: '峰值在线' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
          yaxisRight={{ min: 0, ...(rightMax != null ? { max: rightMax } : {}), seriesName: [''], labels: { formatter: (v) => formatCompactNumber(v) } }}
          yaxisAnnotations={annotations}
        />
      </div>
    </div>
  );
}

/** 赛季区域：全平台整行，下方 Steam / TapPC 并排各 50% */
function SeasonSection({ table }) {
  const seasonQuery = useSeasonData(table);
  const seasons = seasonQuery.data?.seasons || [];
  const loading = seasonQuery.isLoading;
  const error = seasonQuery.error?.message;

  return (
    <>
      <div className="mb-4">
        <SeasonCompareCard title="【全平台】赛季日在线人数对比" field="peak_players" seasons={seasons} loading={loading} error={error} />
      </div>
      <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <SeasonCompareCard title="【Steam】赛季日在线人数对比" field="steam_peak_players" seasons={seasons} loading={loading} error={error} />
        </div>
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <SeasonCompareCard title="【TapPC】赛季日在线人数对比" field="tappc_peak_players" seasons={seasons} loading={loading} error={error} />
        </div>
      </div>
    </>
  );
}

/**
 * 单个服（steam_id）的「实时热销榜 + 周热销榜」两张图。
 * 每个实例各自持有查询，缓存键带 steamId 以避免不同服互相命中。
 */
function ServerCharts({ server }) {
  const trendWhere = useMemo(
    () => [...recentHoursWhere(24), { col: 'steam_id', op: '=', value: server.steamId }],
    [server.steamId]
  );
  const heatmapWhere = useMemo(
    () => [...recentMonthsWhere(3), { col: 'steam_id', op: '=', value: server.steamId }],
    [server.steamId]
  );

  const trendQuery = useChartData(
    `steam-rank-trend-${server.steamId}`,
    (p) => query(TABLE_NAME, p),
    {
      fields: 'steam_id,rank,region,crawled_at',
      where: trendWhere,
      order_by: 'crawled_at ASC',
      limit: 9999,
    },
    { transform: transformTrend }
  );

  const heatmapQuery = useChartData(
    `steam-rank-heatmap-${server.steamId}`,
    (p) => query(WEEKLY_TABLE_NAME, p),
    {
      fields: 'region,crawled_at,rank',
      where: heatmapWhere,
      order_by: 'crawled_at ASC',
      limit: 9999,
    },
    { transform: transformHeatmap }
  );

  return (
    <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
      {/* 实时热销榜（60%） */}
      <div style={{ flex: '60 1 0', minWidth: 0 }}>
        <div className="card border-0 shadow-sm h-100">
          <div className="card-header bg-white border-0 fw-semibold">
            <span>【Steam】{server.label}-实时热销榜 — 最近24小时（Y轴倒序: 排名1=顶部）</span>
          </div>
          <div className="card-body">
            <LineChart
              series={trendQuery.data?.series || []}
              loading={trendQuery.isLoading}
              error={trendQuery.error?.message}
              height={500}
              colors={TREND_COLORS}
              xaxisOverrides={{
                type: 'datetime',
                labels: { format: 'MM/dd HH:mm', datetimeUTC: false, rotate: -45 },
              }}
              yaxisOverrides={{
                reversed: true,
                tickAmount: 10,
                labels: { formatter: (val) => Math.round(val) },
                title: { text: '排名' },
              }}
              strokeWidth={2}
              markers={3}
            />
          </div>
        </div>
      </div>

      {/* 周热销榜（40%） */}
      <div style={{ flex: '40 1 0', minWidth: 0 }}>
        <div className="card border-0 shadow-sm h-100">
          <div className="card-header bg-white border-0 fw-semibold">
            <span>【Steam】{server.label}-周热销榜 — 最近3个月（X=日期, Y=地区, 值=排名）</span>
          </div>
          <div className="card-body">
            <HeatmapChart
              series={heatmapQuery.data?.series || []}
              loading={heatmapQuery.isLoading}
              error={heatmapQuery.error?.message}
              height={500}
              xaxisOverrides={heatmapQuery.data?.categories ? { categories: heatmapQuery.data.categories } : {}}
              colorScale={HEATMAP_RANGES}
              noDataColor="#ffffff"
              valueFormatter={(val) => Math.round(val)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BusinessReport() {
  const [gameKey, setGameKey] = useState(GAME_KEYS[0]);
  const game = STEAM_GAMES[gameKey];

  return (
    <div className="container-fluid p-4">
      <h2 className="fw-bold mb-4">
        <i className="bi bi-bar-chart text-primary me-2"></i>
        Games 数据大盘
      </h2>

      {/* 筛选栏 */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="d-flex align-items-center flex-wrap gap-2">
            <span className="text-muted small me-2">选择游戏:</span>
            {GAME_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={`btn btn-sm ${gameKey === key ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setGameKey(key)}
              >
                {STEAM_GAMES[key].name}
              </button>
            ))}
            <span className="ms-auto text-muted small">
              已选: {game.name}
            </span>
          </div>
        </div>
      </div>

      {/* 【全平台】在线人数趋势（仅配置了数据源的游戏） */}
      {/* 在线人数趋势上方的「历史最高」KPI */}
      {game.kpi && <MaxKpiRow {...game.kpi} />}

      {game.onlineTrend && <OnlineSection config={game.onlineTrend} />}

      {/* 赛季区域：全平台整行 + Steam/TapPC 并排 50% */}
      {game.seasonCompare && <SeasonSection table={game.seasonCompare.table} />}

      {/* 下载区：日趋势(35%) + 全渠道赛季对比(65%) */}
      {game.downloadTrend && game.seasonDownload && (
        <DownloadSection trendConfig={game.downloadTrend} seasonConfig={game.seasonDownload} />
      )}
      {game.downloadTrend && !game.seasonDownload && !game.bestSeller && (
        <div className="mb-4">
          <DownloadTrendCard {...game.downloadTrend} height={450} />
        </div>
      )}
      {game.downloadTrend && game.bestSeller && (
        <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
          <div style={{ flex: '35 1 0', minWidth: 0 }}>
            <DownloadTrendCard
              table={game.downloadTrend.table}
              appName={game.downloadTrend.appName}
              series={game.downloadTrend.series}
              days={game.downloadTrend.days}
              height={500}
            />
          </div>
          <div style={{ flex: '65 1 0', minWidth: 0 }}>
            <BestSellerCard {...game.bestSeller} />
          </div>
        </div>
      )}

      {/* TapTap / iOS 赛季日下载数对比 */}
      {game.seasonDownload && <SeasonDownloadSection {...game.seasonDownload} />}

      {/* 每个服一组：国际服在上、国服在下 */}
      {game.servers.map((server) => (
        <ServerCharts key={`${gameKey}-${server.key}`} server={server} />
      ))}
    </div>
  );
}
