import MonthlyBreakdownCard from './MonthlyTrendCard';
import WeeklyTrendCard from './WeeklyTrendCard';

/**
 * 一行两张图：左 35% 月趋势、右 65% 日趋势（同一口径口径：平台 / 小游戏）
 * @param {string} monthlyKey 月趋势配置 key（platform / gameType）
 * @param {string} weeklyKey 日趋势配置 key（platform / miniGame）
 * @param {Object} monthly 月趋势查询结果 { data, isLoading, error }
 * @param {Object} weekly 日趋势查询结果 { data, isLoading, error }
 * @param {*} realtime 今日实时汇总（覆盖日趋势「今天」那一点）
 * @param {string} notice 日趋势卡片右上角提示
 */
export default function MonthlyWeeklyRow({
  monthlyKey,
  weeklyKey,
  monthly,
  weekly,
  realtime,
  notice,
  monthlyUpdateLabel,
  weeklyUpdateLabel,
}) {
  return (
    <div className="row g-3 mb-4">
      <MonthlyBreakdownCard
        chartKey={monthlyKey}
        data={monthly?.data}
        loading={monthly?.isLoading}
        error={monthly?.error?.message}
        updateLabel={monthlyUpdateLabel}
      />
      <WeeklyTrendCard
        chartKey={weeklyKey}
        data={weekly?.data}
        loading={weekly?.isLoading}
        error={weekly?.error?.message}
        updateLabel={weeklyUpdateLabel}
        realtime={realtime}
        notice={notice}
      />
    </div>
  );
}
