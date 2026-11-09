import { useMemo } from 'react';
import BarChart from '../../components/charts/BarChart';
import TreemapChart from '../../components/charts/TreemapChart';
import DashboardCard from '../../components/layout/DashboardCard';
import UpdateTag from './UpdateTag';
import { nextUpdateLabel } from './updateTime';
import { formatNumber, formatCompactNumber } from '../../utils/formatters';
import {
  buildOnlinePlayersTrendSql,
  buildOnlinePlayersStatsSql,
  buildOnlinePlayersSourceNewestSql,
  buildOnlinePlayersSourceSql,
  buildOnlinePlayersSourceGamesSql,
  buildPcOnlinePeakSourceSql,
  buildPcOnlinePeakKpisSql,
  buildPcOnlinePeakNewestSql,
  buildPcOnlineTop80ListSql,
  buildPcOnlineTop80TrendSql,
} from './sql';
import {
  transformOnlinePlayersTrend,
  transformOnlinePlayersStats,
  transformNewestDate,
  transformOnlinePlayersSource,
  transformOnlinePlayersSourceGames,
  transformPcOnlinePeakSource,
  transformPcOnlinePeakKpis,
  transformPcOnlineTop80List,
  transformPcOnlineTop80Trend,
  ONLINE_PLAYERS_BUCKETS,
} from './transforms';
import { useSqlQuery, useSqlQueryV09 } from './queries';
import DataTable from './components/DataTable';
import { PC_ONLINE_TOP80_COLUMNS, PC_GAME_TYPE_META } from './shared';

/** TapPC 峰值在线 KPI 图标与配色 */
const PC_KPI_META = {
  online: { icon: 'bi-people', color: 'primary' },
  biz: { icon: 'bi-pc-display', color: 'info' },
  mini: { icon: 'bi-controller', color: 'success' },
  tmk: { icon: 'bi-joystick', color: 'warning' },
};

export default function OnlineStats() {
  const onlinePlayersTrendQuery = useSqlQuery('taptap-online-players-trend', buildOnlinePlayersTrendSql, [], transformOnlinePlayersTrend, { enabled: true });
  const onlinePlayersStatsQuery = useSqlQuery('taptap-online-players-stats', buildOnlinePlayersStatsSql, [], transformOnlinePlayersStats, { enabled: true });
  const onlinePlayersSourceNewestQuery = useSqlQuery('taptap-online-players-source-newest', buildOnlinePlayersSourceNewestSql, [], transformNewestDate, { enabled: true });
  const onlinePlayersSourceQuery = useSqlQuery('taptap-online-players-source', () => buildOnlinePlayersSourceSql(onlinePlayersSourceNewestQuery.data), [onlinePlayersSourceNewestQuery.data], transformOnlinePlayersSource, { enabled: !!onlinePlayersSourceNewestQuery.data });
  const onlinePlayersSourceGamesQuery = useSqlQuery('taptap-online-players-source-games', () => buildOnlinePlayersSourceGamesSql(onlinePlayersSourceNewestQuery.data), [onlinePlayersSourceNewestQuery.data], transformOnlinePlayersSourceGames, { enabled: !!onlinePlayersSourceNewestQuery.data });
  const pcSourceNewestQuery = useSqlQuery('taptap-pc-online-peak-newest', buildPcOnlinePeakNewestSql, [], transformNewestDate, { enabled: true });
  const pcSourceGamesOnlinePlayersQuery = useSqlQuery(
    'taptap-pc-online-peak-source',
    () => buildPcOnlinePeakSourceSql(pcSourceNewestQuery.data),
    [pcSourceNewestQuery.data],
    transformPcOnlinePeakSource,
    { enabled: !!pcSourceNewestQuery.data }
  );
  const pcOnlineTop80ListQuery = useSqlQuery(
    'taptap-pc-online-top80-list',
    () => buildPcOnlineTop80ListSql(pcSourceNewestQuery.data),
    [pcSourceNewestQuery.data],
    transformPcOnlineTop80List,
    { enabled: !!pcSourceNewestQuery.data }
  );
  const pcOnlineTop80TrendQuery = useSqlQuery('taptap-pc-online-top80-trend', buildPcOnlineTop80TrendSql, [], transformPcOnlineTop80Trend, { enabled: true });
  // KPI 走 MySQL（v09 接口）的 dws_taptap_pc_online_peak_players_v2_hourly
  const pcOnlinePeakKpisQuery = useSqlQueryV09('taptap-pc-online-peak-kpis', buildPcOnlinePeakKpisSql, [], transformPcOnlinePeakKpis, { enabled: true });
  const pcOnlineTop80Rows = useMemo(() => {
    const list = pcOnlineTop80ListQuery.data?.rows || [];
    const labels = pcOnlineTop80TrendQuery.data?.labels || [];
    const byKey = pcOnlineTop80TrendQuery.data?.byKey || {};
    // 各游戏类型（distribution_type）在同一窗口的在线人数合计：来自来源分布图的第一层数据
    const typeTotals = {};
    (pcSourceGamesOnlinePlayersQuery.data?.data || []).forEach((d) => {
      const type = Object.keys(PC_GAME_TYPE_META).find((k) => PC_GAME_TYPE_META[k].label === d.x);
      if (type != null) typeTotals[type] = Number(d.y || 0);
    });
    const totalOnline = Object.values(typeTotals).reduce((a, b) => a + b, 0);
    return list.map((r) => {
      const series = byKey[String(r.appId)] || {};
      const typeTotal = typeTotals[String(r.distributionType)] || 0;
      const trendValues = Object.values(series);
      const avgOnlinePlayers = trendValues.length
        ? Math.round(trendValues.reduce((a, b) => a + b, 0) / trendValues.length)
        : null;
      return {
        ...r,
        trend: labels.map((l) => series[l] ?? 0),
        trendLabels: labels,
        avgOnlinePlayers,
        dauContribution: totalOnline > 0 ? (r.onlinePlayers / totalOnline) * 100 : null,
        typeContribution: typeTotal > 0 ? (r.onlinePlayers / typeTotal) * 100 : null,
      };
    });
  }, [pcOnlineTop80ListQuery.data, pcOnlineTop80TrendQuery.data, pcSourceGamesOnlinePlayersQuery.data]);

  const trendCategories = onlinePlayersTrendQuery.data?.categories || [];
  const trendRangeStart = trendCategories[0] || '';
  const trendRangeEnd = trendCategories[trendCategories.length - 1] || '';
  // TapPC 在线人数 KPI / 趋势 / 分布图 / Top80 列表：cron「26 */2 * * *」（每 2 小时第 26 分钟）
  const pcUpdateLabel = nextUpdateLabel(26);
  const pcUpdateTop20Label = pcUpdateLabel;

  return (
    <>
      {/* TapPC峰值在线 KPI */}
      <div className="mb-2">
        <UpdateTag text={pcUpdateLabel} />
      </div>
      <div className="row g-3 mb-4">
        {(pcOnlinePeakKpisQuery.data || []).map((k) => {
          const meta = PC_KPI_META[k.key] || {};
          return (
            // 4 张 KPI 大屏排成一排（每张 25%），小屏 2 列、超小屏单列
            <div className="col-12 col-sm-6 col-lg-3" key={k.key}>
              <DashboardCard
                title={k.label}
                value={k.value != null ? formatNumber(k.value) : '-'}
                subtitle={k.at ? `统计时间 ${k.at}` : ''}
                icon={meta.icon || 'bi-graph-up'}
                color={meta.color || 'primary'}
              />
            </div>
          );
        })}
      </div>

      {/* TapPC热玩游戏榜在线人数趋势 */}
      <div className="d-flex flex-wrap gap-3 mb-4 align-items-stretch">
        {/* 趋势（独占整行） */}
        <div style={{ flex: '1 1 100%', minWidth: 0 }}>
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <div className="fw-semibold">TapPC热玩游戏榜在线人数趋势</div>
              <div className="d-flex align-items-center flex-wrap gap-2 mt-1">
                <span className="text-muted small">统计时间范围为最近24小时【{trendRangeStart} - {trendRangeEnd}】，每组左边Bar表示峰值在线玩家数、右边Bar表示记录统计的游戏数</span>
                <UpdateTag text={pcUpdateLabel} />
              </div>
            </div>
            <div className="card-body">
              <BarChart
                series={onlinePlayersTrendQuery.data?.series || []}
                loading={onlinePlayersTrendQuery.isLoading}
                error={onlinePlayersTrendQuery.error?.message}
                height={750}
                stacked
                dataLabelsEnabled
                shared
                fill={{ opacity: 1 }}
                colors={['#7A8B99', '#9CAF9F', '#C4A4A4', '#5C6B7A', '#8A8F6B', '#B08B8B']}
                toolbar={false}
                legendOverrides={{ show: true, position: 'top', horizontalAlign: 'right', fontSize: '12px', itemMargin: { horizontal: 6, vertical: 2 } }}
                xaxisOverrides={onlinePlayersTrendQuery.data?.categories ? { categories: onlinePlayersTrendQuery.data.categories, labels: { rotate: -45 } } : {}}
                yaxisOverrides={{ min: 0, seriesName: ['商业游戏-Players', '独立小游戏-Players', 'Maker小游戏-Players'], title: { text: '峰值在线玩家数' }, labels: { formatter: (v) => formatCompactNumber(v) } }}
                yaxisRight={{ min: 0, max: 2100, seriesName: ['商业游戏-Cnt', '独立小游戏-Cnt', 'Maker小游戏-Cnt'], title: { text: '统计游戏数' }, labels: { formatter: (v) => formatNumber(v) } }}
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

      {/* 第一行：TapPC游戏在线人数分布图（35%） + 在线人数Top80游戏列表（65%） */}
      <div className="row g-3 mb-4 align-items-stretch">
        <div className="col-12 tt-split-35">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <div className="fw-semibold">TapPC游戏在线人数分布图</div>
              <div className="d-flex align-items-center flex-wrap gap-2 mt-1">
                <span className="text-muted small">最新统计窗口为 - {onlinePlayersSourceNewestQuery.data || ''}</span>
                <UpdateTag text={pcUpdateLabel} />
              </div>
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

        <div className="col-12 tt-split-65">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <div className="fw-semibold">在线人数Top80游戏列表</div>
              <div className="d-flex align-items-center flex-wrap gap-2 mt-1">
                <span className="text-muted small">最新统计窗口为 - {pcSourceNewestQuery.data || ''}（按 online_players 取前 80）</span>
                <UpdateTag text={pcUpdateTop20Label} />
              </div>
            </div>
            <DataTable rows={pcOnlineTop80Rows} columns={PC_ONLINE_TOP80_COLUMNS} pageSize={8} fixedLayout rankColWidth="5%" />
          </div>
        </div>
      </div>

    </>
  );
}
