import { useState, useEffect, useMemo } from 'react';
import HourlyTrendSection from './download/HourlyTrendSection';
import DistributionRow from './download/DistributionRow';
import { nextUpdateTime, formatNextUpdate } from './updateTime';
import { formatNowWindow } from './dates';
import {
  buildAggregateSql,
  buildWeeklyTrendSql,
  buildTodayRealtimeSummarySql,
  buildMonthlyBreakdownSql,
  buildDistributionByWindowSql,
  buildNewestDateSql,
  HOURLY_TABLE,
} from './sql';
import {
  transformAggregate,
  transformWeeklyTrend,
  transformTodayRealtime,
  transformMonthlyBreakdown,
  transformDistributionByWindow,
  transformNewestDate,
} from './transforms';
import { useSqlQuery, useSqlQueryV09 } from './queries';
import { useTop25DetailQuery } from './download/useDetailQuery';
import { TOP25_DETAIL_TABLES } from './download/columns';
import {
  WINDOW_TYPES,
  DISTRIBUTION_CHARTS,
  TYPE_FILTER_OPTIONS,
  PLATFORM_FILTER_OPTIONS,
  buildSliceStrokeColors,
  DISTRIBUTION_TYPE_LABELS,
} from './download/constants';
import MonthlyWeeklyRow from './download/MonthlyWeeklyRow';

export default function DownloadStats() {
  const [selectedTable, setSelectedTable] = useState(HOURLY_TABLE);
  const [selectedWindow, setSelectedWindow] = useState(() => formatNowWindow('hour'));
  // 饼图 ↔ 明细表联动：两张饼图默认都选「全部」（平台 = APP+PC，小游戏 = distribution_type 1+2）
  const [platformFilter, setPlatformFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);

  // 提示性文案，仅在渲染时计算一次（不轮询、不额外请求）
  const nowRef = new Date();
  // 热门游戏TopN下载趋势：cron 分钟=5，每 2 小时一次
  const nextUpdateLabelMin5 = `下次更新时间 ${formatNextUpdate(nextUpdateTime(5, nowRef))}`;
  // 月趋势三图：cron 分钟=7，每 2 小时一次
  const nextUpdateLabelMin7 = `下次更新时间 ${formatNextUpdate(nextUpdateTime(7, nowRef))}`;
  // 热门游戏TopN下载日趋势（周对比）：cron 分钟=6，每 2 小时一次
  const nextUpdateLabelMin6 = `下次更新时间 ${formatNextUpdate(nextUpdateTime(6, nowRef))}`;
  // 下载Top25明细查询条件（小时/日/月）→ 关联图表使用的更新频率：5 / 6 / 7 分钟
  const windowGranularity = WINDOW_TYPES.find((w) => w.table === selectedTable)?.granularity || 'hour';
  const windowUpdateLabel =
    windowGranularity === 'day' ? nextUpdateLabelMin6 : windowGranularity === 'month' ? nextUpdateLabelMin7 : nextUpdateLabelMin5;

  const hotListQuery = useSqlQuery('taptap-hot-list-trend', buildAggregateSql, [], transformAggregate, { enabled: true });
  // 周趋势走 MySQL（v09 接口）的 dws_taptap_download_v2_daily（历史数据）
  const weeklyTrendQuery = useSqlQueryV09('taptap-weekly-trend', buildWeeklyTrendSql, [], transformWeeklyTrend, { enabled: true });
  // 今日实时：SQLite 的 dws_taptap_download_summary_hourly 聚合当天，覆盖「今天」那一点
  const todayRealtimeQuery = useSqlQuery('taptap-today-realtime', buildTodayRealtimeSummarySql, [], transformTodayRealtime, {
    enabled: true,
    staleTime: 60 * 1000,
  });
  // 月趋势走 MySQL（v09 接口）的 dws_taptap_download_v2_monthly
  const monthlyBreakdownQuery = useSqlQueryV09('taptap-monthly-breakdown', buildMonthlyBreakdownSql, [], transformMonthlyBreakdown, { enabled: true });
  const distributionByWindowQuery = useSqlQuery('taptap-distribution-by-window', () => buildDistributionByWindowSql(selectedWindow), [selectedWindow], transformDistributionByWindow, { enabled: true });
  const newestDateQuery = useSqlQuery('taptap-newest-date', buildNewestDateSql, [], transformNewestDate);

  const top25DetailQueries = {
    platform: useTop25DetailQuery('platform', TOP25_DETAIL_TABLES.platform, selectedWindow, true, {
      // 全部 = APP+PC 全平台
      referFilter: platformFilter == null ? 'all' : platformFilter,
    }),
    gameType: useTop25DetailQuery('gameType', TOP25_DETAIL_TABLES.gameType, selectedWindow, true, {
      // 全部 = 全部小游戏（distribution_type IN (1,2)），不是「所有游戏类型」
      typeFilter: typeFilter == null ? 'all' : typeFilter,
    }),
  };

  // 明细按饼图选中项过滤（Top50 已在 SQL 里各取，这里只做客户端筛选）
  // 平台明细由 SQL 按饼图选中平台取 Top25，这里不再做客户端筛选
  const platformRows = top25DetailQueries.platform.data?.rows || [];

  // 小游戏表明细由 SQL 按饼图选中类型取 Top25，这里不再做客户端筛选
  const gameTypeRows = top25DetailQueries.gameType.data?.rows || [];

  // 选中扇区加深色描边（其余留白缝），首屏就能看出默认选中了哪一项
  const platformLabels = distributionByWindowQuery.data?.platform?.labels || [];
  const gameTypeLabels = distributionByWindowQuery.data?.gameType?.labels || [];
  const platformStrokeColors = useMemo(
    () =>
      buildSliceStrokeColors(platformLabels, (label) => {
        if (platformFilter == null) return false;
        return platformFilter === (label.includes('APP') ? 'app' : 'pc');
      }),
    [platformLabels.join('|'), platformFilter] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const gameTypeStrokeColors = useMemo(
    () =>
      buildSliceStrokeColors(
        gameTypeLabels,
        (label) => typeFilter != null && DISTRIBUTION_TYPE_LABELS[typeFilter] === label
      ),
    [gameTypeLabels.join('|'), typeFilter] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // 两张饼图各自的联动配置
  const distFilters = {
    platform: { selected: platformFilter, setSelected: setPlatformFilter, options: PLATFORM_FILTER_OPTIONS, strokeColors: platformStrokeColors },
    gameType: { selected: typeFilter, setSelected: setTypeFilter, options: TYPE_FILTER_OPTIONS, strokeColors: gameTypeStrokeColors },
  };

  // 数据最新时间加载后，小时选项的统计窗口默认值同步到最新数据时间，避免数据更新期间空白
  useEffect(() => {
    if (selectedTable === HOURLY_TABLE && newestDateQuery.data) {
      setSelectedWindow(newestDateQuery.data);
    }
  }, [newestDateQuery.data, selectedTable]);

  return (
    <>
      <HourlyTrendSection
        data={hotListQuery.data}
        loading={hotListQuery.isLoading}
        error={hotListQuery.error?.message}
        updateLabel={nextUpdateLabelMin5}
      />

      {/* 月趋势 / 日趋势：平台一组、小游戏一组 */}
      <MonthlyWeeklyRow
        monthlyKey="platform"
        weeklyKey="platform"
        monthly={monthlyBreakdownQuery}
        weekly={weeklyTrendQuery}
        realtime={todayRealtimeQuery.data}
        monthlyUpdateLabel={nextUpdateLabelMin7}
        weeklyUpdateLabel={nextUpdateLabelMin6}
      />
      <MonthlyWeeklyRow
        monthlyKey="gameType"
        weeklyKey="miniGame"
        monthly={monthlyBreakdownQuery}
        weekly={weeklyTrendQuery}
        realtime={todayRealtimeQuery.data}
        monthlyUpdateLabel={nextUpdateLabelMin7}
        weeklyUpdateLabel={nextUpdateLabelMin6}
        notice="11 月 3 日 - 11 月 7 日数据口径调整，所显示数据没有参考意义"
      />

      {/* 下载Top25明细查询条件 */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-0 fw-semibold">下载Top25明细查询条件</div>
        <div className="card-body">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="text-muted small">窗口类型</span>
            {WINDOW_TYPES.map((w) => (
              <button
                key={w.table}
                type="button"
                className={`btn btn-sm ${selectedTable === w.table ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => {
                  setSelectedTable(w.table);
                  setSelectedWindow(w.granularity === 'hour' && newestDateQuery.data ? newestDateQuery.data : formatNowWindow(w.granularity));
                }}
              >
                {w.label}
              </button>
            ))}
            <span className="ms-3 text-muted small">统计窗口</span>
            {/* 只读：窗口值跟随最新数据时间自动同步，避免手输与数据不一致 */}
            <input
              type="text"
              className="form-control form-control-sm"
              style={{ width: 180, backgroundColor: '#F7F9FA', cursor: 'default' }}
              value={selectedWindow}
              readOnly
              aria-readonly="true"
              title="统计窗口跟随数据最新时间自动同步"
            />
          </div>
        </div>
      </div>

      {/* 分布饼图 + TopN 明细：两两一行（平台｜平台明细、小游戏｜小游戏明细） */}
      {[
        ['platform', 'platform'],
        ['gameType', 'gameType'],
      ].map(([distKey, tableKey]) => {
        const distChart = DISTRIBUTION_CHARTS.find((c) => c.key === distKey);
        const distData = distributionByWindowQuery.data?.[distKey];
        return (
          <DistributionRow
            key={`${distKey}-${tableKey}`}
            distKey={distKey}
            tableKey={tableKey}
            dist={{
              title: distChart?.title,
              series: distData?.series,
              labels: distData?.labels,
              totalLabel: distData?.totalLabel,
              totalValue: distData?.totalValue,
              loading: distributionByWindowQuery.isLoading,
              error: distributionByWindowQuery.error?.message,
            }}
            filter={distFilters[distKey]}
            rows={tableKey === 'gameType' ? gameTypeRows : platformRows}
            trend={{
              metric:
                tableKey === 'platform'
                  ? platformFilter === 'pc'
                    ? 'pc_download_count'
                    : platformFilter === 'app'
                      ? 'app_download_count'
                      : 'download_count'
                  : 'download_count',
              label:
                tableKey === 'platform'
                  ? platformFilter === 'pc'
                    ? 'PC下载数'
                    : platformFilter === 'app'
                      ? 'APP下载数'
                      : '总下载数'
                  : '小游戏下载数',
              day: String(selectedWindow || '').slice(0, 10),
            }}
            updateLabel={windowUpdateLabel}
          />
        );
      })}
    </>
  );
}
