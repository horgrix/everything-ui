import { useMemo } from 'react';
import HeatmapChart from '../../components/charts/HeatmapChart';
import TreemapChart from '../../components/charts/TreemapChart';
import MixedChart from '../../components/charts/MixedChart';
import { formatNumber, formatCompactNumber } from '../../utils/formatters';
import {
  buildAdNewPositionStatsSql,
  buildAdMaterialTagsSql,
  buildAdMaterialGamesSql,
  buildAdTotalStatsSql,
  buildAdGameListSql,
  buildAdGameDailyTrendSql,
  buildAdLoadingRateTrendSql,
} from './sql';
import {
  transformAdNewPositionStats,
  transformAdMaterialTags,
  transformAdMaterialGames,
  transformAdTotalStats,
  transformAdGameList,
  transformTapAppAdGameDailyTrend,
  transformAdLoadingRateTrend,
} from './transforms';
import { useSqlQuery } from './queries';
import DataTable from './components/DataTable';
import { AD_MATERIAL_COLORS, AD_GAME_LIST_COLUMNS } from './shared';

export default function TapPcAdStats() {
  const adNewPositionStatsQuery = useSqlQuery('taptap-ad-new-position-stats', buildAdNewPositionStatsSql, [], transformAdNewPositionStats, { enabled: true });
  const adMaterialTagsQuery = useSqlQuery('taptap-ad-material-tags', buildAdMaterialTagsSql, [], transformAdMaterialTags, { enabled: true });
  const adMaterialGamesQuery = useSqlQuery('taptap-ad-material-games', buildAdMaterialGamesSql, [], transformAdMaterialGames, { enabled: true });
  const adTotalStatsQuery = useSqlQuery('taptap-ad-total-stats', buildAdTotalStatsSql, [], transformAdTotalStats, { enabled: true });
  const adGameListQuery = useSqlQuery('taptap-ad-game-list', buildAdGameListSql, [], (rows) => transformAdGameList(rows, adTotalStatsQuery.data), { enabled: !!adTotalStatsQuery.data });
  const adGameDailyTrendQuery = useSqlQuery('taptap-ad-game-daily-trend', buildAdGameDailyTrendSql, [], transformTapAppAdGameDailyTrend, { enabled: true });
  const adGameListRows = useMemo(() => {
    const list = adGameListQuery.data?.rows || [];
    const trendData = adGameDailyTrendQuery.data;
    const days = trendData?.days || [];
    const byApp = trendData?.byApp || {};
    return list.map((r) => ({ ...r, trend: days.map((d) => byApp[r.appId]?.[d] ?? 0), trendLabels: days }));
  }, [adGameListQuery.data, adGameDailyTrendQuery.data]);
  const adLoadingRateTrendQuery = useSqlQuery('taptap-ad-loading-rate-trend', buildAdLoadingRateTrendSql, [], transformAdLoadingRateTrend, { enabled: true });

  return (
    <>
        <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
          <div className="card-header bg-white border-0">
            <div className="fw-semibold">【每日新发现】广告位每日追踪 — 最近7天</div>
            <div className="text-muted small">行=广告位(position)，列=日期(crawled_at)，值=广告加载率(ad_loading_rate)</div>
          </div>
          <div className="card-body">
            <HeatmapChart
              series={adNewPositionStatsQuery.data?.series || []}
              loading={adNewPositionStatsQuery.isLoading}
              error={adNewPositionStatsQuery.error?.message}
              height={500}
              colorScale={[
                { from: 0, to: 0.01, name: '0%', color: '#D8D0E4' },
                { from: 0.01, to: 0.34, name: '1-33%', color: '#B39BC8' },
                { from: 0.34, to: 0.68, name: '34-67%', color: '#8B6FAD' },
                { from: 0.68, to: 1.01, name: '68-100%', color: '#421243' },
              ]}
              valueFormatter={(val) => (val > 0 ? `${Math.round(val * 100)}%` : '')}
              xaxisOverrides={adNewPositionStatsQuery.data?.categories ? { categories: adNewPositionStatsQuery.data.categories } : {}}
              yaxisReversed
            />
          </div>
        </div>
          </div>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
          <div className="card-header bg-white border-0">
            <div className="fw-semibold">【每日新发现】素材标签追踪 — 最近7天</div>
            <div className="text-muted small">第一层=大类(tag_1/tag_2/tag_3 合并)，值=广告加载率；点击下钻查看具体游戏(app_id)</div>
          </div>
          <div className="card-body">
            <TreemapChart
              key={adMaterialTagsQuery.data?.tags?.join(',') || 'empty'}
              series={[{ name: '广告加载率', data: adMaterialTagsQuery.data?.data || [] }]}
              loading={adMaterialTagsQuery.isLoading}
              error={adMaterialTagsQuery.error?.message}
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
                series: (adMaterialTagsQuery.data?.tags || []).map((tag, idx) => ({
                  id: tag,
                  name: tag,
                  data: adMaterialGamesQuery.data?.byTag?.[tag] || [],
                  colors: [AD_MATERIAL_COLORS[idx % AD_MATERIAL_COLORS.length]],
                  plotOptions: { treemap: { distributed: false, enableShades: true, colorScale: { min: 0, max: adMaterialGamesQuery.data?.maxByTag?.[tag] || 1 } } },
                })),
              }}
            />
          </div>
        </div>
          </div>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 fw-semibold">【每日新发现】每日广告加载率 — 最近7天</div>
            <div className="card-body">
              <MixedChart
                series={adLoadingRateTrendQuery.data?.series || []}
                loading={adLoadingRateTrendQuery.isLoading}
                error={adLoadingRateTrendQuery.error?.message}
                height={500}
                toolbar={false}
                colors={['#4361ee', '#421243']}
                strokeWidths={[0, 4]}
                dataLabels={{
                  enabled: true,
                  enabledOnSeries: [0],
                  position: 'top',
                  formatter: (val) => formatNumber(val),
                  style: { fontSize: '11px', colors: ['#6c757d'] },
                }}
                tooltipY={(v, yi) => (yi === 1 ? `${(v * 100).toFixed(2)}%` : formatNumber(v))}
                xaxisOverrides={adLoadingRateTrendQuery.data?.categories ? { type: 'category', categories: adLoadingRateTrendQuery.data.categories, labels: { rotate: -45 } } : {}}
                yaxisLeft={{ title: { text: '曝光次数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
                yaxisRight={{ title: { text: '加载率' }, min: 0, max: 0.3, labels: { formatter: (v) => `${(v * 100).toFixed(0)}%` } }}
              />
            </div>
          </div>
          </div>
        </div>
        <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
          <div className="card-header bg-white border-0 fw-semibold">【每日新发现】曝光游戏明细列表 — 最近7天</div>
          <DataTable rows={adGameListRows} columns={AD_GAME_LIST_COLUMNS} pageSize={10} />
          </div>
          </div>
        </div>

        {/* 分割线：区分“每日新发现”系列与后续图表 */}
        <div className="d-flex align-items-center mb-4" style={{ gap: '1rem' }}>
          <div className="flex-grow-1" style={{ borderTop: '1px dashed #adb5bd' }}></div>
          <span className="text-muted small fw-semibold">每日新发现  End</span>
          <div className="flex-grow-1" style={{ borderTop: '1px dashed #adb5bd' }}></div>
        </div>
    </>
  );
}
