import LineChart from '../../components/charts/LineChart';
import MixedChart from '../../components/charts/MixedChart';
import PieChart from '../../components/charts/PieChart';
import TreemapChart from '../../components/charts/TreemapChart';
import { formatNumber, formatCompactNumber } from '../../utils/formatters';
import {
  buildOnlinePlayersTrendSql,
  buildOnlinePlayersStatsSql,
  buildNewestDateSql,
  buildOnlinePlayersDistributionSql,
  buildOnlinePlayersTopNTrendSql,
  buildOnlinePlayersSourceNewestSql,
  buildOnlinePlayersSourceSql,
  buildOnlinePlayersSourceGamesSql,
  buildPcSourceOnlinePlayersSql,
  buildPcSourceNewestSql,
  buildPcSourceGamesOnlinePlayersSql,
  buildTopNProportionSql,
} from './sql';
import {
  transformOnlinePlayersTrend,
  transformOnlinePlayersStats,
  transformNewestDate,
  transformOnlinePlayersDistribution,
  transformOnlinePlayersTopNTrend,
  transformOnlinePlayersSource,
  transformOnlinePlayersSourceGames,
  transformPcSourceOnlinePlayers,
  transformPcSourceGamesOnlinePlayers,
  transformPcSourceGamesOnlinePlayersGames,
  PC_SOURCE_COLORS,
  PC_SOURCE_TYPES,
  ONLINE_PLAYERS_BUCKETS,
  transformTopNProportion,
} from './transforms';
import { useSqlQuery } from './queries';

export default function OnlineStats() {
  const onlinePlayersTrendQuery = useSqlQuery('taptap-online-players-trend', buildOnlinePlayersTrendSql, [], transformOnlinePlayersTrend, { enabled: true });
  const onlinePlayersStatsQuery = useSqlQuery('taptap-online-players-stats', buildOnlinePlayersStatsSql, [], transformOnlinePlayersStats, { enabled: true });
  const newestDateQuery = useSqlQuery('taptap-newest-date', buildNewestDateSql, [], transformNewestDate);
  const onlinePlayersDistributionQuery = useSqlQuery('taptap-online-players-distribution', () => buildOnlinePlayersDistributionSql(newestDateQuery.data), [newestDateQuery.data], transformOnlinePlayersDistribution, { enabled: !!newestDateQuery.data });
  const onlinePlayersTopNTrendQuery = useSqlQuery('taptap-online-players-topn-trend', buildOnlinePlayersTopNTrendSql, [], transformOnlinePlayersTopNTrend, { enabled: true });
  const onlinePlayersSourceNewestQuery = useSqlQuery('taptap-online-players-source-newest', buildOnlinePlayersSourceNewestSql, [], transformNewestDate, { enabled: true });
  const onlinePlayersSourceQuery = useSqlQuery('taptap-online-players-source', () => buildOnlinePlayersSourceSql(onlinePlayersSourceNewestQuery.data), [onlinePlayersSourceNewestQuery.data], transformOnlinePlayersSource, { enabled: !!onlinePlayersSourceNewestQuery.data });
  const onlinePlayersSourceGamesQuery = useSqlQuery('taptap-online-players-source-games', () => buildOnlinePlayersSourceGamesSql(onlinePlayersSourceNewestQuery.data), [onlinePlayersSourceNewestQuery.data], transformOnlinePlayersSourceGames, { enabled: !!onlinePlayersSourceNewestQuery.data });
  const pcSourceNewestQuery = useSqlQuery('taptap-pc-source-newest', buildPcSourceNewestSql, [], transformNewestDate, { enabled: true });
  const pcSourceOnlinePlayersQuery = useSqlQuery('taptap-pc-source-online-players', buildPcSourceOnlinePlayersSql, [], transformPcSourceOnlinePlayers, { enabled: true });
  const pcSourceGamesOnlinePlayersQuery = useSqlQuery('taptap-pc-source-games', () => buildPcSourceGamesOnlinePlayersSql(pcSourceNewestQuery.data), [pcSourceNewestQuery.data], transformPcSourceGamesOnlinePlayers, { enabled: !!pcSourceNewestQuery.data });
  const pcSourceGamesOnlinePlayersGamesQuery = useSqlQuery('taptap-pc-source-games-detail', () => buildPcSourceGamesOnlinePlayersSql(pcSourceNewestQuery.data), [pcSourceNewestQuery.data], transformPcSourceGamesOnlinePlayersGames, { enabled: !!pcSourceNewestQuery.data });
  const topNProportionQuery = useSqlQuery('taptap-topn-proportion', () => buildTopNProportionSql(newestDateQuery.data), [newestDateQuery.data], transformTopNProportion, { enabled: !!newestDateQuery.data });

  return (
    <>
      {/* TapPC热玩游戏榜在线人数趋势（75%） + TopN游戏占比（25%） */}
      <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
        {/* 趋势（左，75%） */}
        <div style={{ flex: '0 0 70%', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <div className="fw-semibold">TapPC热玩游戏榜在线人数趋势</div>
              <div className="text-muted small">历史统计区间为 [{onlinePlayersStatsQuery.data?.startCrawledAt ?? ''} - {onlinePlayersStatsQuery.data?.endCrawledAt ?? ''}]</div>
            </div>
            <div className="card-body">
              <LineChart
                series={onlinePlayersTrendQuery.data?.series || []}
                loading={onlinePlayersTrendQuery.isLoading}
                error={onlinePlayersTrendQuery.error?.message}
                height={500}
                strokeWidth={[4, 2, 2, 2, 2, 2]}
                strokeDashArray={[0, 5, 5, 5, 5, 5]}
                shared
                xaxisOverrides={onlinePlayersTrendQuery.data?.categories ? { type: 'category', categories: onlinePlayersTrendQuery.data.categories, labels: { rotate: -45 } } : {}}
                yaxisOverrides={{ title: { text: '在线人数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
                yaxisAnnotations={onlinePlayersStatsQuery.data ? [
                  { y: onlinePlayersStatsQuery.data.maxOnlinePlayers, color: '#421243', position: 'center', label: `历史峰值最高值 (${formatNumber(onlinePlayersStatsQuery.data.maxOnlinePlayers)})` },
                  { y: onlinePlayersStatsQuery.data.minOnlinePlayers, color: '#C0ADDB', position: 'center', label: `历史峰值最低值 (${formatNumber(onlinePlayersStatsQuery.data.minOnlinePlayers)})` },
                  { y: onlinePlayersStatsQuery.data.avgOnlinePlayers, color: '#7F94B0', position: 'center', label: `历史峰值均值 (${formatNumber(onlinePlayersStatsQuery.data.avgOnlinePlayers)})` },
                ] : []} />
            </div>
          </div>
        </div>
        {/* TopN游戏占比（右，25%） */}
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <div className="fw-semibold">TopN游戏占比</div>
              <div className="text-muted small">最新统计窗口为 - {newestDateQuery.data || ''}</div>
            </div>
            <div className="card-body">
              <MixedChart
                series={topNProportionQuery.data?.series || []}
                loading={topNProportionQuery.isLoading}
                error={topNProportionQuery.error?.message}
                height={500}
                toolbar={false}
                colors={['#4361ee', '#e71d36']}
                strokeWidths={[0, 2]}
                tooltipY={(v, yi) => (yi === 1 ? v.toFixed(2) + '%' : v.toLocaleString('zh-CN'))}
                xaxisOverrides={topNProportionQuery.data?.categories ? { type: 'category', categories: topNProportionQuery.data.categories, labels: { rotate: -45 } } : {}}
                yaxisLeft={{ title: { text: '在线人数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
                yaxisRight={{ title: { text: '占比 (%)' }, min: 0, max: 100, labels: { formatter: (v) => v.toFixed(2) + '%' } }} />
            </div>
          </div>
        </div>
      </div>

      {/* 游戏数来源占比（30%） + TapPC游戏在线人数来源分布图（70%） */}
      <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
        {/* 游戏数来源占比（左，30%） */}
        <div style={{ flex: '0 0 30%', minWidth: 240 }}>
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <div className="fw-semibold">游戏数来源占比</div>
              <div className="text-muted small">最新统计窗口为 - {pcSourceNewestQuery.data || ''}</div>
            </div>
            <div className="card-body d-flex flex-column align-items-center justify-content-center">
              <PieChart
                series={pcSourceOnlinePlayersQuery.data?.series || []}
                labels={pcSourceOnlinePlayersQuery.data?.labels || []}
                colors={PC_SOURCE_COLORS}
                loading={pcSourceOnlinePlayersQuery.isLoading}
                error={pcSourceOnlinePlayersQuery.error?.message}
                height={420}
                donut
                totalLabel="总在线人数"
                toolbar={false}
              />
            </div>
          </div>
        </div>
        {/* TapPC游戏在线人数来源分布图（右，70%） */}
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <div className="fw-semibold">TapPC游戏在线人数来源分布图</div>
              <div className="text-muted small">最新统计窗口为 - {pcSourceNewestQuery.data || ''}</div>
            </div>
            <div className="card-body">
              <TreemapChart
                key={pcSourceNewestQuery.data}
                series={[{ name: '在线人数', data: pcSourceGamesOnlinePlayersQuery.data?.data || [] }]}
                loading={pcSourceGamesOnlinePlayersQuery.isLoading}
                error={pcSourceGamesOnlinePlayersQuery.error?.message}
                height={420}
                colors={pcSourceGamesOnlinePlayersQuery.data?.colors || []}
                distributed
                drilldown={{
                  enabled: true,
                  breadcrumb: { show: true, position: 'top-left', rootLabel: '在线人数来源' },
                  series: PC_SOURCE_TYPES.map((t, idx) => {
                    const games = pcSourceGamesOnlinePlayersGamesQuery.data?.[t.type] || [];
                    const max = games.length ? Math.max(...games.map((g) => g.y || 0), 1) : 1;
                    return {
                      id: t.type,
                      name: t.label,
                      data: games,
                      colors: [PC_SOURCE_COLORS[idx]],
                      plotOptions: { treemap: { distributed: false, enableShades: true, colorScale: { min: 0, max } } },
                    };
                  }),
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 游戏数占比（30%） + TapPC游戏在线人数分布图（70%） */}
      <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
        {/* 游戏数占比（左，30%） */}
        <div style={{ flex: '0 0 30%', minWidth: 240 }}>
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <div className="fw-semibold">游戏数占比</div>
              <div className="text-muted small">最新统计窗口为 - {newestDateQuery.data || ''}</div>
            </div>
            <div className="card-body d-flex flex-column align-items-center justify-content-center">
              <PieChart
                series={onlinePlayersDistributionQuery.data?.series || []}
                labels={onlinePlayersDistributionQuery.data?.labels || []}
                colors={onlinePlayersDistributionQuery.data?.colors || []}
                loading={onlinePlayersDistributionQuery.isLoading}
                error={onlinePlayersDistributionQuery.error?.message}
                height={500}
                donut
                totalLabel="总游戏数"
                toolbar={false}
                dataLabelsOffset={45}
                minAngleToShowLabel={0}
              />
            </div>
          </div>
        </div>
        {/* TapPC游戏在线人数分布图（右，70%） */}
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <div className="fw-semibold">TapPC游戏在线人数分布图</div>
              <div className="text-muted small">最新统计窗口为 - {onlinePlayersSourceNewestQuery.data || ''}</div>
            </div>
            <div className="card-body">
              <TreemapChart
                key={onlinePlayersSourceNewestQuery.data}
                series={[{ name: '在线人数', data: onlinePlayersSourceQuery.data?.data || [] }]}
                loading={onlinePlayersSourceQuery.isLoading}
                error={onlinePlayersSourceQuery.error?.message}
                height={500}
                colors={onlinePlayersSourceQuery.data?.colors || []}
                distributed
                drilldown={{
                  enabled: true,
                  breadcrumb: { show: true, position: 'top-left', rootLabel: '在线人数分布' },
                  series: ONLINE_PLAYERS_BUCKETS.map((b) => ({
                    id: b.label,
                    name: b.label,
                    data: onlinePlayersSourceGamesQuery.data?.[b.label] || [],
                    colors: [b.color],
                    plotOptions: { treemap: { distributed: false, enableShades: true, colorScale: { min: 0, max: b.ref } } },
                  })),
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* TapPC在线人数TopN趋势图 */}
      <div className="row g-3 mb-4">
        {onlinePlayersTopNTrendQuery.data?.map((card) => (
          <div className="col-12 col-md-3" key={card.appId}>
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 fw-semibold text-truncate">
                {card.appName || '未知'}({card.appId})
              </div>
              <div className="card-body">
                <LineChart
                  series={card.series || []}
                  height={220}
                  xaxisOverrides={{ type: 'category', categories: card.categories, labels: { rotate: -90, rotateAlways: true, offsetY: 10, style: { fontSize: '8px' }, formatter: (value) => String(value).slice(-8) } }}
                  yaxisOverrides={{ title: { text: '在线人数' }, labels: { formatter: (v) => formatCompactNumber(v) } }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
