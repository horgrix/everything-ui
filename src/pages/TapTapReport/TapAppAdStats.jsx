import { useMemo } from 'react';
import HeatmapChart from '../../components/charts/HeatmapChart';
import LineChart from '../../components/charts/LineChart';
import TreemapChart from '../../components/charts/TreemapChart';
import MixedChart from '../../components/charts/MixedChart';
import { formatNumber, formatCompactNumber } from '../../utils/formatters';
import {
  buildTapAppAdNewPositionStatsSql,
  buildTapAppAdMaterialTagsSql,
  buildTapAppAdMaterialGamesSql,
  buildTapAppAdGameListSql,
  buildTapAppAdGameDailyTrendSql,
  buildTapAppAdOverviewStatsSql,
  buildTapAppAdOverviewDailyTrendSql,
  buildTapAppAdOverviewHourlyTrendSql,
  buildTapAppAdRankSql,
  buildTapAppAdTotalStatsSql,
  buildTapAppAdLoadingRateTrendSql,
  buildTapAppSearchPositionStatsSql,
  buildTapAppSearchLoadingRateTrendSql,
  buildTapAppSearchKeywordStatsSql,
  buildTapAppSearchKeywordDailyTrendSql,
  buildTapAppSearchTotalStatsSql,
  buildTapAppSearchKeywordOverviewSql,
  buildTapAppSearchKeywordOverviewDailyTrendSql,
  buildTapAppSearchKeywordRankSql,
} from './sql';
import {
  transformTapAppAdNewPositionStats,
  transformAdMaterialTags,
  transformAdMaterialGames,
  transformAdTotalStats,
  transformAdGameList,
  transformTapAppAdGameDailyTrend,
  transformTapAppAdOverviewStats,
  transformTapAppAdOverviewDailyTrend,
  transformTapAppAdOverviewHourlyTrend,
  transformTapAppAdRank,
  transformAdLoadingRateTrend,
  transformTapAppSearchPositionStats,
  transformTapAppSearchLoadingRateTrend,
  transformTapAppSearchKeywordStats,
  transformTapAppSearchKeywordDailyTrend,
  transformTapAppSearchTotalStats,
  transformTapAppSearchKeywordOverview,
  transformTapAppSearchKeywordOverviewDailyTrend,
  transformTapAppSearchKeywordRank,
} from './transforms';
import { useSqlQuery } from './queries';
import DataTable from './components/DataTable';
import DashboardCard from '../../components/layout/DashboardCard';
import { AD_MATERIAL_COLORS, TAPAPP_AD_GAME_LIST_COLUMNS, TAPAPP_SEARCH_KEYWORD_COLUMNS, SEARCH_SOURCES } from './shared';

export default function TapAppAdStats() {
  const tapAppAdNewPositionStatsQuery = useSqlQuery('taptap-app-ad-new-position-stats', buildTapAppAdNewPositionStatsSql, [], transformTapAppAdNewPositionStats, { enabled: true });
  const tapAppAdMaterialTagsQuery = useSqlQuery('taptap-app-ad-material-tags', buildTapAppAdMaterialTagsSql, [], transformAdMaterialTags, { enabled: true });
  const tapAppAdMaterialGamesQuery = useSqlQuery('taptap-app-ad-material-games', buildTapAppAdMaterialGamesSql, [], transformAdMaterialGames, { enabled: true });
  const tapAppAdTotalStatsQuery = useSqlQuery('taptap-app-ad-total-stats', buildTapAppAdTotalStatsSql, [], transformAdTotalStats, { enabled: true });
  const tapAppAdGameListQuery = useSqlQuery('taptap-app-ad-game-list', buildTapAppAdGameListSql, [], (rows) => transformAdGameList(rows, tapAppAdTotalStatsQuery.data), { enabled: !!tapAppAdTotalStatsQuery.data });
  const tapAppAdGameDailyTrendQuery = useSqlQuery('taptap-app-ad-game-daily-trend', buildTapAppAdGameDailyTrendSql, [], transformTapAppAdGameDailyTrend, { enabled: true });
  const tapAppAdOverviewStatsQuery = useSqlQuery('taptap-app-ad-overview-stats', buildTapAppAdOverviewStatsSql, [], transformTapAppAdOverviewStats, { enabled: true });
  const tapAppAdOverviewDailyTrendQuery = useSqlQuery('taptap-app-ad-overview-daily-trend', buildTapAppAdOverviewDailyTrendSql, [], transformTapAppAdOverviewDailyTrend, { enabled: true });
  const tapAppAdOverviewHourlyTrendQuery = useSqlQuery('taptap-app-ad-overview-hourly-trend', buildTapAppAdOverviewHourlyTrendSql, [], transformTapAppAdOverviewHourlyTrend, { enabled: true });
  const tapAppAdRankQuery = useSqlQuery('taptap-app-ad-rank', buildTapAppAdRankSql, [], transformTapAppAdRank, { enabled: true });
  const tapAppAdLoadingRateTrendQuery = useSqlQuery('taptap-app-ad-loading-rate-trend', buildTapAppAdLoadingRateTrendSql, [], transformAdLoadingRateTrend, { enabled: true });
  const tapAppSearchPositionStatsQuery = useSqlQuery('taptap-app-search-position-stats', buildTapAppSearchPositionStatsSql, [], transformTapAppSearchPositionStats, { enabled: true });
  const tapAppSearchLoadingRateTrendQuery = useSqlQuery('taptap-app-search-loading-rate-trend', buildTapAppSearchLoadingRateTrendSql, [], transformTapAppSearchLoadingRateTrend, { enabled: true });
  const tapAppSearchKeywordStatsQuery = useSqlQuery('taptap-app-search-keyword-stats', buildTapAppSearchKeywordStatsSql, [], transformTapAppSearchKeywordStats, { enabled: true });
  const tapAppSearchKeywordDailyTrendQuery = useSqlQuery('taptap-app-search-keyword-daily-trend', buildTapAppSearchKeywordDailyTrendSql, [], transformTapAppSearchKeywordDailyTrend, { enabled: true });
  const tapAppSearchTotalStatsQuery = useSqlQuery('taptap-app-search-total-stats', buildTapAppSearchTotalStatsSql, [], transformTapAppSearchTotalStats, { enabled: true });
  const tapAppSearchKeywordOverviewQuery = useSqlQuery('taptap-app-search-keyword-overview', buildTapAppSearchKeywordOverviewSql, [], transformTapAppSearchKeywordOverview, { enabled: true });
  const tapAppSearchKeywordOverviewDailyTrendQuery = useSqlQuery('taptap-app-search-keyword-overview-daily-trend', buildTapAppSearchKeywordOverviewDailyTrendSql, [], transformTapAppSearchKeywordOverviewDailyTrend, { enabled: true });
  const tapAppSearchKeywordRankQuery = useSqlQuery('taptap-app-search-keyword-rank', buildTapAppSearchKeywordRankSql, [], transformTapAppSearchKeywordRank, { enabled: true });
  const tapAppSearchKeywordRows = useMemo(() => {
    const statsData = tapAppSearchKeywordStatsQuery.data;
    const trendData = tapAppSearchKeywordDailyTrendQuery.data;
    const rankByKey = tapAppSearchKeywordRankQuery.data?.byKey || {};
    if (!statsData) return { discovery: [], hot_search: [], hot_spot: [] };
    return Object.fromEntries(SEARCH_SOURCES.map((src) => {
      const rows = statsData[src.key]?.rows || [];
      const days = trendData?.[src.key]?.days || [];
      const byKeyword = trendData?.[src.key]?.byKeyword || {};
      return [src.key, rows.map((r) => {
        const rank = rankByKey[`${src.key}:${r.keyword}`] || {};
        return {
          ...r,
          trend: days.map((d) => byKeyword[r.keyword]?.[d] ?? 0),
          trendLabels: days,
          dailyRank: rank.daily ?? null,
          weeklyRank: rank.weekly ?? null,
          monthlyRank: rank.monthly ?? null,
        };
      })];
    }));
  }, [tapAppSearchKeywordStatsQuery.data, tapAppSearchKeywordDailyTrendQuery.data, tapAppSearchKeywordRankQuery.data]);
  const tapAppSearchKeywordTotalRows = useMemo(() => {
    const overview = tapAppSearchKeywordOverviewQuery.data;
    const trend = tapAppSearchKeywordOverviewDailyTrendQuery.data;
    if (!overview) return { discovery: null, hot_search: null, hot_spot: null };
    return Object.fromEntries(SEARCH_SOURCES.map((src) => {
      const s = overview[src.key];
      if (!s) return [src.key, null];
      const showCnt = s.showCnt;
      const adCnt = s.adCnt;
      return [src.key, {
        keyword: '总计',
        showCnt,
        iosShowCnt: s.iosShowCnt,
        androidShowCnt: s.androidShowCnt,
        adCnt,
        iosAdCnt: s.iosAdCnt,
        androidAdCnt: s.androidAdCnt,
        adDeliveryRate: null,
        adContributionRate: null,
        adLoadingRate: showCnt > 0 ? parseFloat(((adCnt / showCnt) * 100).toFixed(2)) : null,
        trend: trend?.[src.key]?.adCnts || [],
        trendLabels: trend?.[src.key]?.days || [],
      }];
    }));
  }, [tapAppSearchKeywordOverviewQuery.data, tapAppSearchKeywordOverviewDailyTrendQuery.data]);
  const tapAppAdGameRows = useMemo(() => {
    const list = tapAppAdGameListQuery.data?.rows || [];
    const trendData = tapAppAdGameDailyTrendQuery.data;
    const days = trendData?.days || [];
    const byApp = trendData?.byApp || {};
    const rankByApp = tapAppAdRankQuery.data?.byApp || {};
    return list.map((r) => ({
      ...r,
      trend: days.map((d) => byApp[r.appId]?.[d] ?? 0),
      trendLabels: days,
      dailyRank: rankByApp[r.appId]?.daily ?? null,
      weeklyRank: rankByApp[r.appId]?.weekly ?? null,
      monthlyRank: rankByApp[r.appId]?.monthly ?? null,
    }));
  }, [tapAppAdGameListQuery.data, tapAppAdGameDailyTrendQuery.data, tapAppAdRankQuery.data]);
  const tapAppAdTotalRow = useMemo(() => {
    const stats = tapAppAdOverviewStatsQuery.data;
    const trend = tapAppAdOverviewDailyTrendQuery.data;
    if (!stats) return null;
    const showCnt = stats.totalViews;
    const adCnt = stats.adViews;
    return {
      appId: null,
      appName: '总计',
      tag1: null,
      tag2: null,
      tag3: null,
      distributionType: null,
      showCnt,
      iosShowCnt: stats.iosViews,
      androidShowCnt: stats.androidViews,
      adCnt,
      iosAdCnt: stats.iosAdViews,
      androidAdCnt: stats.androidAdViews,
      adDeliveryRate: null,
      adContributionRate: null,
      adLoadingRate: showCnt > 0 ? parseFloat(((adCnt / showCnt) * 100).toFixed(2)) : null,
      trend: trend?.adCnts || [],
      trendLabels: trend?.days || [],
    };
  }, [tapAppAdOverviewStatsQuery.data, tapAppAdOverviewDailyTrendQuery.data]);

  return (
    <>
        {/* 首页找游戏 · 广告位每日追踪（当天）+ 广告加载率趋势 */}
        <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
          <div style={{ flex: '0 0 25%', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
          <div className="card-header bg-white border-0">
            <div className="fw-semibold">【首页找游戏】广告位每日追踪 — 当天</div>
            <div className="text-muted small">行=广告位(position)，列=ios/android，值=广告加载率(ad_loading_rate)</div>
          </div>
          <div className="card-body">
            <HeatmapChart
              series={tapAppAdNewPositionStatsQuery.data?.series || []}
              loading={tapAppAdNewPositionStatsQuery.isLoading}
              error={tapAppAdNewPositionStatsQuery.error?.message}
              height={500}
              colorScale={[
                { from: 0, to: 0.01, name: '0%', color: '#D8D0E4' },
                { from: 0.01, to: 0.34, name: '1-33%', color: '#B39BC8' },
                { from: 0.34, to: 0.68, name: '34-67%', color: '#8B6FAD' },
                { from: 0.68, to: 1.01, name: '68-100%', color: '#421243' },
              ]}
              valueFormatter={(val) => (val > 0 ? `${Math.round(val * 100)}%` : '')}
              xaxisOverrides={tapAppAdNewPositionStatsQuery.data?.categories ? { categories: tapAppAdNewPositionStatsQuery.data.categories } : {}}
              yaxisReversed
            />
          </div>
        </div>
          </div>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">【首页找游戏】广告加载率趋势 — 最近24小时</div>
            <div className="card-body">
              <LineChart
                series={tapAppAdOverviewHourlyTrendQuery.data?.series || []}
                loading={tapAppAdOverviewHourlyTrendQuery.isLoading}
                error={tapAppAdOverviewHourlyTrendQuery.error?.message}
                height={500}
                colors={['#5C6B7A', '#A9BAC4', '#9CAF9F']}
                strokeWidth={[4, 2, 2]}
                strokeDashArray={[0, 5, 5]}
                shared
                markers={0}
                xaxisOverrides={tapAppAdOverviewHourlyTrendQuery.data?.categories ? { type: 'category', categories: tapAppAdOverviewHourlyTrendQuery.data.categories, labels: { rotate: -45 } } : {}}
                yaxisOverrides={{ title: { text: '加载率(%)' }, labels: { formatter: (v) => `${v}%` } }}
              />
            </div>
          </div>
          </div>
        </div>

        {/* 首页找游戏 · 素材标签追踪 + 每日加载率 */}
        <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
          <div className="card-header bg-white border-0">
            <div className="fw-semibold">【首页找游戏】素材标签追踪 — 最近30天</div>
            <div className="text-muted small">第一层=大类(tag_1/tag_2/tag_3 合并)，值=广告加载率；点击下钻查看具体游戏(app_id)</div>
          </div>
          <div className="card-body">
            <TreemapChart
              key={tapAppAdMaterialTagsQuery.data?.tags?.join(',') || 'empty'}
              series={[{ name: '广告加载率', data: tapAppAdMaterialTagsQuery.data?.data || [] }]}
              loading={tapAppAdMaterialTagsQuery.isLoading}
              error={tapAppAdMaterialTagsQuery.error?.message}
              height={500}
              distributed
              colors={AD_MATERIAL_COLORS}
              dataLabelsFormatter={(val, opts) => {
                const y = Number(opts?.value ?? 0);
                const seriesName = opts?.w?.config?.series?.[opts?.seriesIndex]?.name;
                // 第一层 series name 固定为「广告加载率」→ 显示加载率百分比；第二层(drilldown) → 显示加载次数
                if (seriesName && seriesName !== '广告加载率') {
                  return `${val} ${Math.round(y)}`;
                }
                return `${val} ${Math.round(y * 100)}%`;
              }}
              drilldown={{
                enabled: true,
                breadcrumb: { show: true, position: 'top-left', rootLabel: '素材标签追踪' },
                series: (tapAppAdMaterialTagsQuery.data?.tags || []).map((tag, idx) => ({
                  id: tag,
                  name: tag,
                  data: tapAppAdMaterialGamesQuery.data?.byTag?.[tag] || [],
                  colors: [AD_MATERIAL_COLORS[idx % AD_MATERIAL_COLORS.length]],
                  plotOptions: { treemap: { distributed: false, enableShades: true, colorScale: { min: 0, max: tapAppAdMaterialGamesQuery.data?.maxByTag?.[tag] || 1 } } },
                })),
              }}
            />
          </div>
        </div>
          </div>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">【首页找游戏】每日广告加载率 — 最近30天</div>
            <div className="card-body">
              <MixedChart
                series={tapAppAdLoadingRateTrendQuery.data?.series || []}
                loading={tapAppAdLoadingRateTrendQuery.isLoading}
                error={tapAppAdLoadingRateTrendQuery.error?.message}
                height={500}
                toolbar={false}
                colors={['#7A8B99', '#B08B8B']}
                strokeWidths={[0, 4]}
                dataLabels={{
                  enabled: true,
                  enabledOnSeries: [0],
                  position: 'top',
                  formatter: (val) => formatNumber(val),
                  style: { fontSize: '11px', colors: ['#6c757d'] },
                }}
                tooltipY={(v, yi) => (yi === 1 ? `${(v * 100).toFixed(2)}%` : formatNumber(v))}
                xaxisOverrides={tapAppAdLoadingRateTrendQuery.data?.categories ? { type: 'category', categories: tapAppAdLoadingRateTrendQuery.data.categories, labels: { rotate: -45 } } : {}}
                yaxisLeft={{ title: { text: '曝光次数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
                yaxisRight={{ title: { text: '加载率' }, min: 0, max: 0.3, labels: { formatter: (v) => `${(v * 100).toFixed(0)}%` } }}
              />
            </div>
          </div>
          </div>
        </div>

        {/* 首页找游戏 · 曝光游戏明细列表（整行） */}
        <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
          <div className="card-header bg-white border-0">
            <div className="fw-semibold">【首页找游戏】曝光游戏明细列表 — 最近30天</div>
            <div className="text-muted small">记录了TapTap App(IOS+Android2个平台)首页找游戏前20个位置素材广告曝光情况，每2小时自动由系统采集一次。</div>
          </div>
          <DataTable rows={tapAppAdGameRows} columns={TAPAPP_AD_GAME_LIST_COLUMNS} pageSize={10} totalRow={tapAppAdTotalRow} fixedLayout rankColWidth="3%" />
          </div>
          </div>
        </div>

        {/* 分割线：区分“首页找游戏”系列与“搜索页”系列 */}
        <div className="d-flex align-items-center mb-4" style={{ gap: '1rem' }}>
          <div className="flex-grow-1" style={{ borderTop: '1px dashed #adb5bd' }}></div>
          <span className="text-muted small fw-semibold">首页找游戏  End</span>
          <div className="flex-grow-1" style={{ borderTop: '1px dashed #adb5bd' }}></div>
        </div>

        {/* 搜索页 · 每日广告加载率（最近30天） */}
        <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">【搜索页】每日广告加载率 — 最近30天</div>
            <div className="card-body">
              <MixedChart
                series={tapAppSearchLoadingRateTrendQuery.data?.series || []}
                loading={tapAppSearchLoadingRateTrendQuery.isLoading}
                error={tapAppSearchLoadingRateTrendQuery.error?.message}
                height={500}
                toolbar={false}
                colors={['#7A8B99', '#B08B8B']}
                strokeWidths={[0, 4]}
                dataLabels={{
                  enabled: true,
                  enabledOnSeries: [0],
                  position: 'top',
                  formatter: (val) => formatNumber(val),
                  style: { fontSize: '11px', colors: ['#6c757d'] },
                }}
                tooltipY={(v, yi) => (yi === 1 ? `${(v * 100).toFixed(2)}%` : formatNumber(v))}
                xaxisOverrides={tapAppSearchLoadingRateTrendQuery.data?.categories ? { type: 'category', categories: tapAppSearchLoadingRateTrendQuery.data.categories, labels: { rotate: -45 } } : {}}
                yaxisLeft={{ title: { text: '曝光次数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
                yaxisRight={{ title: { text: '加载率' }, min: 0, max: 0.3, labels: { formatter: (v) => `${(v * 100).toFixed(0)}%` } }}
              />
            </div>
          </div>
          </div>
        </div>

        {/* 搜索页广告 · 广告位追踪 + 搜索关键词统计（按来源分类） */}
        {SEARCH_SOURCES.map((src) => (
          <div key={src.key} className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
            <div style={{ flex: '0 0 25%', minWidth: 0 }} className="d-flex flex-column">
              <div className="row g-2 mb-3">
                <div className="col-6">
                  <DashboardCard title="总曝光数" value={tapAppSearchTotalStatsQuery.data?.[src.key]?.totalShowCnt != null ? formatNumber(tapAppSearchTotalStatsQuery.data[src.key].totalShowCnt) : '-'} icon="bi-eye" color="primary" />
                </div>
                <div className="col-6">
                  <DashboardCard title="总投放数" value={tapAppSearchTotalStatsQuery.data?.[src.key]?.totalAdCnt != null ? formatNumber(tapAppSearchTotalStatsQuery.data[src.key].totalAdCnt) : '-'} icon="bi-bullseye" color="success" />
                </div>
                <div className="col-12">
                  <DashboardCard title="广告加载率" value={(() => { const s = tapAppSearchTotalStatsQuery.data?.[src.key]; return s && s.totalShowCnt > 0 ? `${((s.totalAdCnt / s.totalShowCnt) * 100).toFixed(2)}%` : '-'; })()} icon="bi-percent" color="info" />
                </div>
              </div>
            <div className="card border-0 shadow-sm flex-grow-1 d-flex flex-column">
            <div className="card-header bg-white border-0">
              <div className="fw-semibold">【搜索页】广告位追踪({src.label}) — 当天</div>
              <div className="text-muted small">行=广告位(position)，列=ios/android，值=广告加载率(ad_loading_rate)</div>
            </div>
            <div className="card-body flex-grow-1 d-flex flex-column">
              <HeatmapChart
                series={tapAppSearchPositionStatsQuery.data?.[src.key]?.series || []}
                loading={tapAppSearchPositionStatsQuery.isLoading}
                error={tapAppSearchPositionStatsQuery.error?.message}
                height="100%"
                colorScale={[
                  { from: 0, to: 0.01, name: '0%', color: '#D8D0E4' },
                  { from: 0.01, to: 0.34, name: '1-33%', color: '#B39BC8' },
                  { from: 0.34, to: 0.68, name: '34-67%', color: '#8B6FAD' },
                  { from: 0.68, to: 1.01, name: '68-100%', color: '#421243' },
                ]}
                valueFormatter={(val) => (val > 0 ? `${Math.round(val * 100)}%` : '')}
                xaxisOverrides={tapAppSearchPositionStatsQuery.data?.[src.key]?.categories ? { categories: tapAppSearchPositionStatsQuery.data[src.key].categories } : {}}
                yaxisReversed
              />
            </div>
          </div>
            </div>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">【搜索页】搜索关键词广告统计({src.label}) — 最近7天</div>
            <DataTable rows={tapAppSearchKeywordRows[src.key] || []} columns={TAPAPP_SEARCH_KEYWORD_COLUMNS} pageSize={10} totalRow={tapAppSearchKeywordTotalRows[src.key] || null} />
          </div>
            </div>
          </div>
        ))}
    </>
  );
}
