import { useMemo } from 'react';
import BarChart from '../../components/charts/BarChart';
import TreemapChart from '../../components/charts/TreemapChart';
import { formatNumber, formatCompactNumber } from '../../utils/formatters';
import {
  buildOnlinePlayersTrendSql,
  buildOnlinePlayersStatsSql,
  buildOnlinePlayersSourceNewestSql,
  buildOnlinePlayersSourceSql,
  buildOnlinePlayersSourceGamesSql,
  buildPcOnlinePeakSourceSql,
  buildPcOnlinePeakTotalsSql,
  buildPcOnlinePeakNewestSql,
  buildPcOnlinePeakRankSql,
  buildPcOnlineTop20ListSql,
  buildPcOnlineTop20TrendSql,
} from './sql';
import {
  transformOnlinePlayersTrend,
  transformOnlinePlayersStats,
  transformNewestDate,
  transformOnlinePlayersSource,
  transformOnlinePlayersSourceGames,
  transformPcOnlinePeakSource,
  transformPcOnlinePeakTotals,
  transformPcOnlinePeakRank,
  transformPcOnlineTop20List,
  transformPcOnlineTop20Trend,
  PC_SOURCE_COLORS,
  PC_SOURCE_TYPES,
  ONLINE_PLAYERS_BUCKETS,
} from './transforms';
import { useSqlQuery } from './queries';
import DataTable from './components/DataTable';
import { PC_ONLINE_TOP20_COLUMNS } from './shared';

export default function OnlineStats() {
  const onlinePlayersTrendQuery = useSqlQuery('taptap-online-players-trend', buildOnlinePlayersTrendSql, [], transformOnlinePlayersTrend, { enabled: true });
  const onlinePlayersStatsQuery = useSqlQuery('taptap-online-players-stats', buildOnlinePlayersStatsSql, [], transformOnlinePlayersStats, { enabled: true });
  const onlinePlayersSourceNewestQuery = useSqlQuery('taptap-online-players-source-newest', buildOnlinePlayersSourceNewestSql, [], transformNewestDate, { enabled: true });
  const onlinePlayersSourceQuery = useSqlQuery('taptap-online-players-source', () => buildOnlinePlayersSourceSql(onlinePlayersSourceNewestQuery.data), [onlinePlayersSourceNewestQuery.data], transformOnlinePlayersSource, { enabled: !!onlinePlayersSourceNewestQuery.data });
  const onlinePlayersSourceGamesQuery = useSqlQuery('taptap-online-players-source-games', () => buildOnlinePlayersSourceGamesSql(onlinePlayersSourceNewestQuery.data), [onlinePlayersSourceNewestQuery.data], transformOnlinePlayersSourceGames, { enabled: !!onlinePlayersSourceNewestQuery.data });
  const pcSourceNewestQuery = useSqlQuery('taptap-pc-online-peak-newest', buildPcOnlinePeakNewestSql, [], transformNewestDate, { enabled: true });
  const pcSourceGamesOnlinePlayersQuery = useSqlQuery('taptap-pc-online-peak-source', buildPcOnlinePeakSourceSql, [], transformPcOnlinePeakSource, { enabled: true });
  const pcSourceGamesOnlinePlayersGamesQuery = useSqlQuery('taptap-pc-online-peak-rank', buildPcOnlinePeakRankSql, [], transformPcOnlinePeakRank, { enabled: true });
  const pcOnlineTop20ListQuery = useSqlQuery('taptap-pc-online-top20-list', buildPcOnlineTop20ListSql, [], transformPcOnlineTop20List, { enabled: true });
  const pcOnlineTop20TrendQuery = useSqlQuery('taptap-pc-online-top20-trend', buildPcOnlineTop20TrendSql, [], transformPcOnlineTop20Trend, { enabled: true });
  const pcOnlinePeakTotalsQuery = useSqlQuery('taptap-pc-online-peak-totals', buildPcOnlinePeakTotalsSql, [], transformPcOnlinePeakTotals, { enabled: true });
  const pcOnlineTop20Rows = useMemo(() => {
    const list = pcOnlineTop20ListQuery.data?.rows || [];
    const labels = pcOnlineTop20TrendQuery.data?.labels || [];
    const byKey = pcOnlineTop20TrendQuery.data?.byKey || {};
    const totals = pcOnlinePeakTotalsQuery.data;
    const totalOnline = totals?.total || 0;
    return list.map((r) => {
      const series = byKey[`${r.appId}::${r.listType}`] || {};
      const typeTotal = totals?.byType?.[r.listType] || 0;
      return {
        ...r,
        trend: labels.map((l) => series[l] ?? 0),
        trendLabels: labels,
        dauContribution: totalOnline > 0 ? (r.onlinePlayers / totalOnline) * 100 : null,
        typeContribution: typeTotal > 0 ? (r.onlinePlayers / typeTotal) * 100 : null,
      };
    });
  }, [pcOnlineTop20ListQuery.data, pcOnlineTop20TrendQuery.data, pcOnlinePeakTotalsQuery.data]);

  return (
    <>
      {/* TapPC热玩游戏榜在线人数趋势 */}
      <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
        {/* 趋势（独占整行） */}
        <div style={{ flex: '1 1 100%', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <div className="fw-semibold">TapPC热玩游戏榜在线人数趋势</div>
              <div className="text-muted small">最近24小时</div>
            </div>
            <div className="card-body">
              <BarChart
                series={onlinePlayersTrendQuery.data?.series || []}
                loading={onlinePlayersTrendQuery.isLoading}
                error={onlinePlayersTrendQuery.error?.message}
                height={600}
                stacked
                dataLabelsEnabled
                shared
                fill={{ opacity: 1 }}
                colors={['#7A8B99', '#9CAF9F', '#C4A4A4', '#D6C9B0', '#7A8B99', '#9CAF9F', '#C4A4A4', '#D6C9B0']}
                toolbar={false}
                legendOverrides={{ show: false }}
                xaxisOverrides={onlinePlayersTrendQuery.data?.categories ? { categories: onlinePlayersTrendQuery.data.categories, labels: { rotate: -45 } } : {}}
                yaxisOverrides={{ min: 0, seriesName: ['TapPC峰值在线玩家数', 'TapPC模拟器峰值在线玩家数', 'TapPC小游戏C峰值在线玩家数', 'TapPC小游戏M峰值在线玩家数'], title: { text: '峰值在线玩家数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
                yaxisRight={{ min: 0, max: 1500, seriesName: ['TapPC统计游戏数', 'TapPC模拟器统计游戏数', 'TapPC小游戏C统计游戏数', 'TapPC小游戏M统计游戏数'], title: { text: '统计游戏数' }, labels: { formatter: (v) => formatNumber(v) } }}
                annotations={onlinePlayersStatsQuery.data ? [
                  { y: onlinePlayersStatsQuery.data.maxOnlinePlayers, color: '#421243', position: 'center', label: `历史峰值玩家最高值 (${formatNumber(onlinePlayersStatsQuery.data.maxOnlinePlayers)})` },
                  { y: onlinePlayersStatsQuery.data.minOnlinePlayers, color: '#C0ADDB', position: 'center', label: `历史峰值玩家最低值 (${formatNumber(onlinePlayersStatsQuery.data.minOnlinePlayers)})` },
                  { y: onlinePlayersStatsQuery.data.avgOnlinePlayers, color: '#7F94B0', position: 'center', label: `历史峰值玩家平均值 (${formatNumber(onlinePlayersStatsQuery.data.avgOnlinePlayers)})` },
                ] : []}
              />
            </div>
          </div>
        </div>
      </div>

      {/* TapPC游戏在线人数来源分布图（左，50%） + TapPC游戏在线人数分布图（右，50%） */}
      <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
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
                height={500}
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
        {/* TapPC游戏在线人数分布图（右，50%） */}
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

      {/* 在线人数Top20游戏列表 */}
      <div className="mb-4">
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white border-0">
            <div className="fw-semibold">在线人数Top20游戏列表</div>
            <div className="text-muted small">最新统计窗口为 - {pcSourceNewestQuery.data || ''}（每个来源取 list_type_rk ≤ 20）</div>
          </div>
          <DataTable rows={pcOnlineTop20Rows} columns={PC_ONLINE_TOP20_COLUMNS} pageSize={10} fixedLayout rankColWidth="5%" />
        </div>
      </div>

    </>
  );
}
