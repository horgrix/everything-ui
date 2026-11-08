import { useMemo } from 'react';
import BarChart from '../../components/charts/BarChart';
import UpdateTag from './UpdateTag';
import DataTable from './components/DataTable';
import Sparkline from '../../components/common/Sparkline';
import { GameIcon, taptapAppUrl, APP_AD_TAG_COLORS, truncateName } from './shared';
import { useSqlQuery } from './queries';
import { buildReserveTrendSql, buildReserveTopSql, buildReserveTopTrendSql } from './sql';
import { transformReserveTrend, transformReserveTop, transformReserveTopTrend } from './transforms';
import { formatNumber, formatCompactNumber } from '../../utils/formatters';

/** 预约新增 Top50 表格列 */
const RESERVE_TOP_COLUMNS = [
  {
    header: 'APPID',
    width: '12%',
    accessor: (r) => r.appId,
    render: (r) => (
      <a
        href={taptapAppUrl(r.appId)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-decoration-none small"
        style={{ color: '#4361ee', whiteSpace: 'nowrap' }}
        title={`在 TapTap 打开（APPID ${r.appId}）`}
      >
        {r.appId}
      </a>
    ),
  },
  {
    header: '标签',
    width: '24%',
    accessor: (r) => r.tags.join(' '),
    render: (r) => {
      if (!r.tags.length) return <span className="text-muted">-</span>;
      return (
        <div className="d-flex flex-wrap gap-1">
          {r.tags.map((tag, i) => (
            <span
              key={`${tag}-${i}`}
              className="badge"
              style={{ backgroundColor: APP_AD_TAG_COLORS[`tag${i + 1}`], color: '#fff', fontSize: 10, padding: '2px 5px', fontWeight: 500 }}
            >
              {tag}
            </span>
          ))}
        </div>
      );
    },
  },
  {
    header: '游戏名称',
    width: '30%',
    accessor: (r) => r.appName,
    render: (r) => (
      <span className="d-inline-flex align-items-center gap-2" title={r.appName || undefined} style={{ minWidth: 0, maxWidth: '100%' }}>
        <GameIcon src={r.icon} size={20} alt={r.appName ? `${r.appName} 图标` : ''} />
        <span className="fw-semibold" style={{ display: 'inline-block', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
          {truncateName(r.appName) || '-'}
        </span>
      </span>
    ),
  },
  {
    header: '历史总预约数',
    align: 'end',
    width: '15%',
    accessor: (r) => r.totalReserveCount,
    render: (r) => (r.totalReserveCount == null ? <span className="text-muted">-</span> : <span className="text-muted">{formatNumber(r.totalReserveCount)}</span>),
  },
  {
    header: '新增预约数',
    align: 'end',
    width: '14%',
    help: '按天聚合：今天各快照 reserve_count 之和',
    accessor: (r) => r.dailyReserveCount,
    render: (r) => <span className="fw-semibold">{r.dailyReserveCount == null ? '-' : formatNumber(r.dailyReserveCount)}</span>,
  },
  {
    header: '本日趋势',
    align: 'center',
    width: '20%',
    help: '今天各抓取时点的 reserve_count 走势',
    render: (r) => <Sparkline data={r.trend || []} labels={r.trendLabels || []} width={120} height={32} />,
  },
];

/** 预约排行榜分页大小 */
const TOP_PAGE_SIZE = 10;

/**
 * TapTap预约统计
 *
 * 数据源：SQLite 的 dws_taptap_reserve_summary_v2_hourly（小时级汇总，每 2 小时一个点）
 * - 预约数 = reserve_count（左轴）
 * - 游戏数 = game_conut（右轴，注意上游列名就是 game_conut）
 * 图表为 Grouped Bar（两根柱并排）+ 双坐标轴。
 */
export default function ReserveStats() {
  const trendQuery = useSqlQuery('taptap-reserve-trend', buildReserveTrendSql, [], transformReserveTrend, {
    staleTime: 5 * 60 * 1000,
  });
  const topQuery = useSqlQuery('taptap-reserve-top', () => buildReserveTopSql(50), [], transformReserveTop, {
    staleTime: 5 * 60 * 1000,
  });
  // 本日趋势（sparkline）：今天各快照的 reserve_count
  const topTrendQuery = useSqlQuery('taptap-reserve-top-trend', () => buildReserveTopTrendSql(50), [], transformReserveTopTrend, {
    staleTime: 5 * 60 * 1000,
  });
  const topRows = useMemo(() => {
    const list = topQuery.data?.rows || [];
    const labels = topTrendQuery.data?.labels || [];
    const byApp = topTrendQuery.data?.byApp || {};
    return list.map((r) => {
      const series = byApp[String(r.appId)] || {};
      return {
        ...r,
        trend: labels.map((l) => series[l] ?? null),
        trendLabels: labels,
      };
    });
  }, [topQuery.data, topTrendQuery.data]);

  const categories = trendQuery.data?.categories || [];
  const rangeStart = categories[0] || '';
  const rangeEnd = categories[categories.length - 1] || '';

  return (
    <>
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-0">
          <div className="fw-semibold">热门预约榜在榜游戏预约趋势</div>
          <div className="d-flex align-items-center flex-wrap gap-2 mt-1">
            <span className="text-muted small">
              统计时间范围为最近24小时【{rangeStart} - {rangeEnd}】，左轴为预约数、右轴为在榜游戏数（dws_taptap_reserve_summary_v2_hourly）
            </span>
            <UpdateTag text="每 2 小时抓取一次" />
          </div>
        </div>
        <div className="card-body">
          <BarChart
            series={trendQuery.data?.series || []}
            loading={trendQuery.isLoading}
            error={trendQuery.error?.message}
            height={550}
            colors={['#7A8B99', '#9CAF9F']}
            shared
            fill={{ opacity: 1 }}
            toolbar={false}
            legendOverrides={{ show: true, position: 'top', horizontalAlign: 'right', fontSize: '12px', itemMargin: { horizontal: 6, vertical: 2 } }}
            xaxisOverrides={categories.length ? { categories, labels: { rotate: -45 } } : {}}
            yaxisOverrides={{
              seriesName: '预约数',
              min: 0,
              title: { text: '预约数' },
              labels: { formatter: (v) => formatCompactNumber(v) },
            }}
            yaxisRight={{
              seriesName: '游戏数',
              min: 0,
              max: 500,
              title: { text: '在榜游戏数' },
              labels: { formatter: (v) => formatNumber(v) },
            }}
          />
        </div>
      </div>

      {/* 热门预约榜在榜游戏预约新增 Top50 */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-0">
          <div className="fw-semibold">热门预约榜在榜游戏预约新增Top50</div>
          <div className="d-flex align-items-center flex-wrap gap-2 mt-1">
            <span className="text-muted small">
              最新统计窗口 {rangeEnd || '-'}；新增预约数按天聚合（今日各快照 reserve_count 之和），按该值降序取前 50；本日趋势为各时点走势（dws_taptap_reserve_v2_hourly）
            </span>
            <UpdateTag text="每 2 小时抓取一次" />
          </div>
        </div>
        <DataTable
          rows={topRows}
          columns={RESERVE_TOP_COLUMNS}
          pageSize={TOP_PAGE_SIZE}
          fixedLayout
          rankColWidth="5%"
        />
      </div>
    </>
  );
}
