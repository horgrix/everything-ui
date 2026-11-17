/**
 * 预约区块（周报 / 月报第 07 节）
 *
 * 只呈现接口给的数：本期新增、日均、覆盖天数、分型拆解、两个榜（期间新增 / 期末累计）。
 * 不出期级趋势线 —— 预约采集 2026-11-08 才上线，期数不够，画出来会误导（见 reserve.js 顶部口径）。
 * 数据来源：everything-api `/periodic/report` 的 `reserve` 块（缺该块时这一节整节不出现）。
 */
import { useState } from 'react';
import { DeltaChip, Panel, PanelHead, Placeholder, fmtCompact, fmtFull } from './prKit';
import { coverageText, periodLabelOf } from './reserve';
import { RankIcon } from './Sections';

const RESERVE_COLOR = '#A4577C';
const DIST_COLORS = { 0: '#5C7F8E', 1: '#7E9B84', 2: '#B99B72' };

function shareText(share) {
  if (share == null || Number.isNaN(Number(share))) return '—';
  return `${Number(share).toFixed(1)}%`;
}

function Stat({ label, value, unit, sub, title }) {
  return (
    <div className="pr-reserve-stat" title={title || undefined}>
      <div className="pr-reserve-stat-label">{label}</div>
      <div className="pr-reserve-stat-value">
        {value}
        {unit && <span className="pr-reserve-stat-unit">{unit}</span>}
      </div>
      <div className="pr-reserve-stat-sub">{sub}</div>
    </div>
  );
}

function RankList({ list, rankType }) {
  if (!list.length) return <div className="pr-rank-empty">本期暂无榜单数据</div>;
  return (
    <div className="pr-rank-list">
      {list.slice(0, 8).map((item, index) => {
        const main = rankType === 'gain' ? item.gain : item.total;
        const other = rankType === 'gain' ? item.total : item.gain;
        const otherLabel = rankType === 'gain' ? '期末累计' : '本期新增';
        return (
          <div
            className={`pr-rank-row${item.rankNo <= 3 ? ` is-top${item.rankNo}` : ''}`}
            key={`${item.appId}-${item.rankNo ?? index}`}
          >
            <span className="pr-rank-no">{item.rankNo ?? index + 1}</span>
            <RankIcon src={item.icon} name={item.appName} />
            <div style={{ minWidth: 0 }}>
              <div className="pr-rank-name">
                {item.appName}
                {item.distLabel && (
                  <span style={{ color: '#A7B0B8', fontSize: 9.5, marginLeft: 5 }}>{item.distLabel}</span>
                )}
              </div>
              <div className="pr-rank-tags">
                {otherLabel} {other == null ? '—' : fmtCompact(other)}
              </div>
            </div>
            <div className="pr-rank-value">
              {main == null ? '—' : fmtCompact(main)}
              <small style={{ color: '#8A959E' }}>次</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ReserveSection({ reserve, periodType }) {
  const [rankType, setRankType] = useState('gain');
  if (!reserve) return null;

  if (reserve.available === false) {
    return (
      <Panel>
        <Placeholder icon="bi-calendar-x">
          {reserve.reason || '这一期没有预约数据（预约采集 2026-11-08 上线，更早的期无法回补）'}
        </Placeholder>
      </Panel>
    );
  }

  const { coverage, headline, dist, ranks } = reserve;

  // 不给日均环比时，四种原因各写各的：上期无数据 / 本期进行中 / 本期没采满 / 上期没采满。
  // 拿「1 天的日均」比「7 天的日均」，会把周末效应读成增长或腰斩，所以这四种一律不画百分比。
  const dayText = (cnt, expected) => (expected != null ? `${cnt ?? '—'}/${expected} 天` : `${cnt ?? '—'} 天`);
  const prevLabel = periodLabelOf(headline.prevPeriodKey, periodType);
  const blockedText = {
    prev_missing: `${prevLabel ? `上期（${prevLabel}）` : '上期'}无预约数据`,
    current_in_progress: '本期进行中，日均环比待本期走完',
    current_partial: `本期仅覆盖 ${dayText(coverage.dayCnt, coverage.expectedDays)}`,
    prev_partial: `上期仅覆盖 ${dayText(headline.prevDayCnt, headline.prevExpectedDays)}`,
  };
  // 「本期进行中」这句自己已经说清为什么没有环比，不要再拖一个「日均不可比」尾巴
  const compareText = headline.dailyAvgComparable
    ? null
    : headline.dailyAvgBlocked === 'current_in_progress'
      ? blockedText.current_in_progress
      : `${blockedText[headline.dailyAvgBlocked] || '日均环比暂不可比'} · 日均不可比`;
  const compareHint =
    '日均只在两期都覆盖满整期时才给环比：拿「1 天的日均」比「7 天的日均」，会把周末效应读成增长或腰斩';
  const totalAdd = dist.reduce((sum, row) => sum + (row.add || 0), 0);
  const coverageLabel = coverageText(coverage);
  const rankTabs = [
    { key: 'gain', label: '新增榜', hint: '本期新增预约' },
    { key: 'total', label: '累计榜', hint: '期末累计预约' },
  ];

  return (
    // 与业务线明细共用一套「左信息 / 右榜单」栅格
    <div className="pr-line-row pr-reserve">
      <Panel className="pr-reserve-main">
        <PanelHead
          color={RESERVE_COLOR}
          icon="bi-bookmark-star"
          title="TapTap 预约"
          sub="尚未上线游戏的预约热度 · 预约池口径，不是平台大盘"
          right={
            coverageLabel && (
              <span className={`pr-coverage${coverage.thinCoverage ? ' is-partial' : ''}`} title="该期预约数据实际覆盖的天数">
                {coverageLabel}
              </span>
            )
          }
        />

        <div className="pr-reserve-stats">
          <Stat
            label="本期新增预约"
            value={headline.add == null ? '—' : fmtCompact(headline.add)}
            unit="次"
            title={headline.add == null ? undefined : fmtFull(headline.add)}
            sub={
              <>
                {headline.dailyAvg != null && (
                  <span className="pr-reserve-muted">日均 {fmtCompact(headline.dailyAvg)} 次/日</span>
                )}
                {headline.dailyAvgComparable ? (
                  <>
                    <span className="pr-reserve-chip-label">日均环比</span>
                    <DeltaChip pct={headline.dailyAvgPct} hasValue={headline.dailyAvg != null} size="sm" showAbs={false} />
                  </>
                ) : (
                  <span className="pr-reserve-muted" title={compareHint}>
                    {compareText}
                  </span>
                )}
              </>
            }
          />
          <Stat
            label="有新增预约的游戏"
            value={headline.gameCnt == null ? '—' : fmtFull(headline.gameCnt)}
            unit="款"
            sub={
              headline.roster != null ? (
                <span className="pr-reserve-muted">预约池覆盖 {fmtFull(headline.roster)} 款</span>
              ) : null
            }
            title="期内至少新增 1 次预约的款数；覆盖款数是期内进过预约池的总款数"
          />
          <Stat
            label="期末预约累计"
            value={headline.totalEnd == null ? '—' : fmtCompact(headline.totalEnd)}
            unit="次"
            title={headline.totalEnd == null ? undefined : fmtFull(headline.totalEnd)}
            sub={<span className="pr-reserve-muted">游戏上线即退出池子，跨期不可比</span>}
          />
        </div>

        {dist.length > 0 && (
          <div className="pr-reserve-dist">
            <div className="pr-reserve-dist-head">
              <span>分型拆解</span>
              <span className="pr-reserve-muted">按期内游戏当前分型归类 · 款数相加大于合计</span>
            </div>
            {dist.map((row) => (
              <div className="pr-reserve-dist-row" key={row.key}>
                <span className="pr-reserve-dist-name">{row.label}</span>
                <div className="pr-reserve-dist-bar">
                  <i
                    style={{
                      width: `${Math.max(0, Math.min(row.share ?? 0, 100))}%`,
                      background: DIST_COLORS[row.key] || '#9AA6AE',
                    }}
                  />
                </div>
                <span className="pr-reserve-dist-share">{shareText(row.share)}</span>
                <span className="pr-reserve-dist-value">{row.add == null ? '—' : fmtCompact(row.add)}</span>
                <span className="pr-reserve-dist-cnt">{row.gameCnt == null ? '—' : `${row.gameCnt} 款`}</span>
                {(() => {
                  // 分母优先用该行自己的 expectedDayCnt（355c853），老接口才退回外层的
                  const expected = row.expectedDays ?? coverage.expectedDays;
                  if (row.dayCnt == null || expected == null || row.dayCnt >= expected) return <span />;
                  return (
                    <span
                      className="pr-reserve-dist-days"
                      title={`该分型本期只有 ${row.dayCnt} 天有采集（${row.firstDay?.slice(5) || '—'}~${row.lastDay?.slice(5) || '—'}），新增量偏低是覆盖不足，不是需求下降`}
                    >
                      {row.dayCnt}/{expected} 天
                    </span>
                  );
                })()}
              </div>
            ))}
            <div className="pr-reserve-note">
              分型合计 {fmtCompact(totalAdd)} 次，与本期新增一致；款数按分型各自去重，同一款期内换过分型会被算进多个分型。
            </div>
          </div>
        )}
      </Panel>

      <Panel className="pr-reserve-rank">
        <div className="pr-rank-head">
          <span className="pr-panel-icon" style={{ color: RESERVE_COLOR, background: `${RESERVE_COLOR}14` }}>
            <i className="bi bi-trophy" />
          </span>
          <div>
            <div className="pr-rank-head-title">预约榜</div>
            <div className="pr-rank-head-sub">
              {rankTabs.find((tab) => tab.key === rankType)?.hint} · 前 {Math.min((ranks[rankType] || []).length, 8)} 款
            </div>
          </div>
          <div className="pr-rank-switch">
            {rankTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={tab.key === rankType ? 'is-active' : ''}
                onClick={() => setRankType(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <RankList list={ranks[rankType] || []} rankType={rankType} />
      </Panel>
    </div>
  );
}
