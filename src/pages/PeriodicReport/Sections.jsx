import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ChartWrapper from '../../components/charts/ChartWrapper';
import { fetchRank } from '../../api/periodic';
import {
  LINE_META,
  LEVEL_META,
  Coverage,
  DeltaChip,
  Panel,
  PanelHead,
  NoteMark,
  Placeholder,
  Sparkline,
  fmtCompact,
  fmtCutoff,
  fmtDateTime,
  fmtFull,
  fmtPct,
} from './prKit';
import { indexedKpis } from './coreKpis';

/* ================================================================== 封面 */

/**
 * 刊头：本期的两个「主数字」放大，其余核心指标放到下面的 KPI 卡里看细节。
 * 文案里的涨跌全部来自接口的 deltaPct，不在前端重算。
 */
export function Cover({ report, periodType }) {
  const { meta, coreKpis = [], flags = [] } = report;
  const byKey = Object.fromEntries(coreKpis.map((k) => [k.key, k]));
  const download = byKey.download_total;
  // 在线峰值的对外键名改过一次（online_peak → online_peak_players），两种都认
  const peak = byKey.online_peak_players || byKey.online_peak;

  const highFlags = flags.filter((f) => f.level === 'high');
  const withValue = coreKpis.filter((k) => k.hasValue).length;
  const newHigh = coreKpis.filter(
    (k) => k.hasValue && k.trend.length >= 3 && k.value >= Math.max(...k.trend.map((t) => t.value ?? -Infinity))
  ).length;

  const headlinePct = (kpi) => {
    if (!kpi || !kpi.hasValue) return null;
    const text = fmtPct(kpi.deltaPct);
    if (!text) return null;
    const tone = kpi.deltaPct > 0 ? 'up' : kpi.deltaPct < 0 ? 'down' : 'flat';
    return { text, tone, comparable: kpi.deltaComparable };
  };

  const dl = headlinePct(download);
  const pk = headlinePct(peak);
  const prevLabel = (kpi) => (kpi?.prevValue == null ? null : fmtCompact(kpi.prevValue));

  return (
    <section className="pr-cover">
      <div className="pr-cover-inner">
        <div>
          <div className="pr-cover-kicker">
            {periodType === 'weekly' ? 'Weekly Brief' : 'Monthly Brief'} · {meta.periodLabel}
          </div>
          <h2 className="pr-cover-title">
            {download?.hasValue ? (
              <>
                全站下载 <b>{fmtCompact(download.value)}</b> {download.unit}
                {dl && (
                  <span className={`pr-cover-${dl.tone}`} style={{ fontSize: 16, marginLeft: 8 }}>
                    {dl.text}
                  </span>
                )}
                ，
              </>
            ) : (
              <>本期下载数据缺失，
              </>
            )}
            {peak?.hasValue ? (
              <>
                在线峰值 <b>{fmtCompact(peak.value)}</b> {peak.unit}
                {pk && (
                  <span className={`pr-cover-${pk.tone}`} style={{ fontSize: 16, marginLeft: 8 }}>
                    {pk.text}
                  </span>
                )}
              </>
            ) : (
              <>在线数据本期未产出</>
            )}
          </h2>
          <div className="pr-cover-note">
            {prevLabel(download) && `较上期 ${fmtCompact(download.prevValue)} ${download.unit}`}
            {prevLabel(peak) && ` · 在线较上期 ${fmtCompact(peak.prevValue)} ${peak.unit}`}
            {newHigh > 0 && ` · ${newHigh} 项核心指标处于近 ${Math.max(...coreKpis.map((k) => k.trend.length), 1)} 期高位`}
            {` · 数据更新于 ${fmtDateTime(meta.updatedAt) || '—'}`}
          </div>
          <div className="pr-cover-tags">
            <span className="pr-cover-tag">
              <i className="bi bi-check2-circle" />
              {withValue}/{coreKpis.length} 项核心指标有值
            </span>
            {meta.isPartial && (
              <span className="pr-cover-tag is-warn">
                <i className="bi bi-hourglass-split" />
                进行中 · 截至 {fmtCutoff(meta)} · 环比只作参考
              </span>
            )}
            {highFlags.length > 0 && (
              <span className="pr-cover-tag is-warn">
                <i className="bi bi-exclamation-triangle" />
                {highFlags.length} 条高优先级口径提示
              </span>
            )}
            <span className="pr-cover-tag">
              <i className="bi bi-collection" />
              {meta.availablePeriods.length} 期可回看
            </span>
          </div>
        </div>
        <div className="pr-cover-numeral">
          <div className="pr-cover-week">{periodType === 'weekly' ? `W${meta.periodKey.split('-')[1]}` : meta.periodKey.split('-')[1]}</div>
          <div className="pr-cover-range">
            {meta.periodStart} — {meta.periodEnd}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== 核心 KPI */

/** 单个核心指标卡：大字数值 + 环比 + 迷你趋势 + 可用期数 */
export function KpiCard({ kpi, totalPeriods }) {
  const line = LINE_META[kpi.line] || LINE_META.download;
  const trend = kpi.trend || [];
  const first = trend[0];
  const last = trend[trend.length - 1];
  const noTrend = kpi.insufficientHistory || trend.length < 3;

  return (
    <article className="pr-kpi" style={{ '--kpi-color': line.color }}>
      <div className="pr-kpi-top">
        <span className="pr-kpi-label">
          {kpi.label}
          <NoteMark note={kpi.note} />
        </span>
        <Coverage available={kpi.availablePeriods || []} total={totalPeriods} />
      </div>
      <div className="pr-kpi-value" title={`${fmtFull(kpi.value)} ${kpi.unit}`}>
        <span className="pr-kpi-num">{fmtCompact(kpi.value)}</span>
        <span className="pr-kpi-unit">{kpi.unit}</span>
      </div>
      <div className="pr-kpi-meta">
        <DeltaChip
          pct={kpi.deltaPct}
          abs={kpi.deltaAbs}
          unit={kpi.unit}
          comparable={kpi.deltaComparable}
          hasValue={kpi.hasValue}
          insufficientHistory={kpi.insufficientHistory}
          blocked={kpi.deltaBlocked}
          reason={kpi.unavailableReason}
          showAbs
        />
        {kpi.prevValue != null && (
          <span>
            上期 {fmtCompact(kpi.prevValue)} {kpi.unit}
          </span>
        )}
      </div>
      <div className="pr-kpi-spark">
        {noTrend ? (
          <div className="pr-spark-empty" style={{ height: 40 }} title="可用期数不足 3 期，接口不给趋势结论">
            {trend.length >= 2
              ? `${trend[0].label} ${fmtCompact(trend[0].value)} → ${trend[trend.length - 1].label} ${fmtCompact(trend[trend.length - 1].value)}`
              : '可用期数不足，暂无趋势'}
          </div>
        ) : (
          <Sparkline points={trend} color={line.color} height={40} />
        )}
      </div>
      <div className="pr-kpi-foot">
        <span>{first?.label || '—'}</span>
        <span>{last?.label || '—'}</span>
      </div>
    </article>
  );
}

export function KpiGrid({ coreKpis, totalPeriods }) {
  return (
    <div className="pr-kpi-grid">
      {coreKpis.map((kpi) => (
        <KpiCard key={kpi.key} kpi={kpi} totalPeriods={totalPeriods} />
      ))}
    </div>
  );
}

/* ================================================================== 趋势 */

/** 从接口数据里生成「本期要点」：只用已给出的值，不做额外推断 */
export function buildInsights(report) {
  const { lines, flags = [], meta } = report;
  const out = [];
  // 下载结构一条要看 APP / PC 下载量，它们已不在核心区（在那里会被三款数挤掉），从业务线明细里拿
  const byKey = Object.fromEntries(indexedKpis(report));

  // 1) 高优先级口径问题永远排第一
  flags
    .filter((f) => f.level === 'high')
    .slice(0, 2)
    .forEach((f) => out.push({ tone: 'warn', icon: 'bi-exclamation-triangle', text: <><b>{f.label}</b>：{f.detail}</> }));

  // 2) 下载结构（APP / PC）
  const total = byKey.download_total;
  const app = byKey.download_app;
  const pc = byKey.download_pc;
  if (total?.hasValue && app?.hasValue && pc?.hasValue) {
    const appShare = (app.value / total.value) * 100;
    const pcShare = (pc.value / total.value) * 100;
    out.push({
      tone: 'info',
      icon: 'bi-pie-chart',
      text: (
        <>
          下载以 APP 为主：<b>{appShare.toFixed(1)}%</b> 来自 APP（{fmtCompact(app.value)} 次），PC 占{' '}
          <b>{pcShare.toFixed(1)}%</b>（{fmtCompact(pc.value)} 次）。
        </>
      ),
    });
  }

  // 3) 分型里增速最快的一类（下载线，占比 ≥ 5% 才算得上结构性变化）
  const downloadLine = lines.find((l) => l.key === 'download');
  const dists = (downloadLine?.breakdown?.items || []).filter((d) => d.hasData && d.deltaPct != null);
  if (dists.length) {
    const fastest = dists.reduce((a, b) => (b.deltaPct > a.deltaPct ? b : a));
    if (fastest.share != null && fastest.share >= 0.05) {
      out.push({
        tone: 'info',
        icon: 'bi-layers',
        text: (
          <>
            分型里 <b>{fastest.label}</b> 增长最快（<em>{fmtPct(fastest.deltaPct)}</em>，占下载 {fmtCompact(fastest.value)} 次 /{' '}
            {(fastest.share * 100).toFixed(1)}%）。
          </>
        ),
      });
    }
  }

  // 4) 连续上升 / 下降的指标（至少 4 期，避免把两期噪声说成趋势）
  const streak = [];
  (report.coreKpis || []).forEach((k) => {
    const values = (k.trend || []).map((t) => t.value).filter((v) => v != null);
    if (values.length < 4) return;
    const dir = Math.sign(values[values.length - 1] - values[values.length - 2]);
    if (dir === 0) return;
    let steps = 0;
    for (let i = values.length - 1; i > 0; i -= 1) {
      if (Math.sign(values[i] - values[i - 1]) !== dir) break;
      steps += 1;
    }
    if (steps >= 3) streak.push({ kpi: k, run: steps * dir });
  });
  if (streak.length) {
    const best = streak.sort((a, b) => Math.abs(b.run) - Math.abs(a.run))[0];
    const recent = (best.kpi.trend || []).filter((t) => t.value != null);
    out.push({
      tone: 'info',
      icon: best.run > 0 ? 'bi-graph-up-arrow' : 'bi-graph-down-arrow',
      text: (
        <>
          <b>{best.kpi.label}</b> 最近 <b>{Math.abs(best.run) + 1}</b> 期连续{best.run > 0 ? '上升' : '下降'}
          {recent.length >= 2 && `（${recent[recent.length - Math.abs(best.run) - 1]?.label} → ${recent[recent.length - 1].label}）`}。
        </>
      ),
    });
  }

  // 5) 趋势期数不足的提醒
  const short = (report.coreKpis || []).filter((k) => k.insufficientHistory && k.hasValue);
  if (short.length) {
    out.push({
      tone: 'muted',
      icon: 'bi-info-circle',
      text: (
        <>
          {short.map((k) => k.label).join('、')} 只有 {Math.min(...short.map((k) => k.historyPoints))} 期数据，
          {' '}按口径不画趋势线，只看当期值（覆盖不全时连环比也不出）。
        </>
      ),
    });
  }

  if (meta.isPartial) {
    out.push({
      tone: 'muted',
      icon: 'bi-hourglass-split',
      text: <>本期尚未走完（数据截至 {fmtCutoff(meta)}），数值为累计进度，和上一完整期不可比。</>,
    });
  }

  return out.slice(0, 4);
}

const TONE_STYLE = {
  warn: { color: '#9A7A35', background: 'rgba(154,122,53,0.12)' },
  info: { color: '#3F6B8F', background: 'rgba(62,110,158,0.10)' },
  muted: { color: '#7B8993', background: 'rgba(123,137,147,0.10)' },
};

export function TrendSection({ report, no = '02' }) {
  const { coreKpis = [], meta } = report;
  const [activeKey, setActiveKey] = useState('download_total');
  const kpi = coreKpis.find((k) => k.key === activeKey) || coreKpis[0];
  const insights = useMemo(() => buildInsights(report), [report]);

  if (!kpi) return null;
  const line = LINE_META[kpi.line] || LINE_META.download;
  const trend = (kpi.trend || []).filter((t) => t.value != null);
  const first = trend[0];
  const last = trend[trend.length - 1];
  const change = first && last && first.value ? ((last.value - first.value) / first.value) * 100 : null;

  return (
    <section className="pr-section">
      <div className="pr-section-head">
        <div className="pr-section-title">
          <span className="pr-section-no">{no}</span>趋势
          <span className="pr-section-sub">近 {trend.length} 期 · {kpi.label}</span>
        </div>
        <div className="pr-chart-tabs" role="tablist" aria-label="趋势指标切换">
          {coreKpis.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={item.key === kpi.key}
              className={item.key === kpi.key ? 'is-active' : ''}
              onClick={() => setActiveKey(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pr-trend">
        <Panel>
          <div className="pr-chart-wrap">
            {trend.length >= 3 ? (
              <ChartWrapper
                type="area"
                height={268}
                series={[{ name: kpi.label, data: trend.map((t) => t.value) }]}
                options={{
                  chart: {
                    id: `pr-trend-${kpi.key}`,
                    toolbar: { show: false },
                    zoom: { enabled: false },
                    fontFamily: 'inherit',
                    animations: { enabled: true, speed: 420 },
                    parentHeightOffset: 0,
                  },
                  colors: [line.color],
                  stroke: { curve: 'smooth', width: 2.2 },
                  fill: {
                    type: 'gradient',
                    gradient: { shadeIntensity: 1, opacityFrom: 0.24, opacityTo: 0.01, stops: [0, 95] },
                  },
                  markers: { size: 3.4, strokeWidth: 2, strokeColors: '#fff', hover: { size: 6 } },
                  dataLabels: { enabled: false },
                  grid: { borderColor: '#EDF0F2', strokeDashArray: 3, padding: { left: 12, right: 16, top: 0, bottom: 0 } },
                  xaxis: {
                    categories: trend.map((t) => t.label),
                    type: 'category',
                    axisBorder: { show: false },
                    axisTicks: { show: false },
                    labels: { style: { colors: '#8A959E', fontSize: '11px' } },
                    tooltip: { enabled: false },
                  },
                  yaxis: {
                    tickAmount: 4,
                    labels: { formatter: (v) => fmtCompact(v, 0), style: { colors: '#A7B0B8', fontSize: '10.5px' } },
                  },
                  tooltip: {
                    theme: 'light',
                    y: { formatter: (v) => `${fmtFull(v)} ${kpi.unit}` },
                  },
                  legend: { show: false },
                }}
              />
            ) : (
              <Placeholder height={268} icon="bi-graph-down">
                可用期数不足 3 期，按口径不画趋势线
                <span style={{ fontSize: 10.5, marginTop: 2 }}>
                  {trend.length === 2
                    ? `${trend[0].label} ${fmtCompact(trend[0].value)} → ${trend[1].label} ${fmtCompact(trend[1].value)}`
                    : '仅 1 期有值'}
                </span>
              </Placeholder>
            )}
          </div>
          <div className="pr-chart-foot">
            <span>
              口径：{kpi.label}（{kpi.unit}）· 来源 {line.label}
            </span>
            {change != null && trend.length >= 3 && (
              <span>
                {first.label} → {last.label} 累计变化{' '}
                <b style={{ color: change >= 0 ? '#2F7A57' : '#B4483F' }}>{fmtPct(change)}</b>
              </span>
            )}
            <span style={{ marginLeft: 'auto' }}>
              共 {meta.availablePeriods.length} 期 · 缺值期不补 0
            </span>
          </div>
        </Panel>

        <Panel>
          <PanelHead color="#6B5B86" icon="bi-lightning-charge" title="本期要点" sub="由接口数值直接生成，不做额外推断" />
          <div className="pr-insights">
            {insights.map((item, index) => (
              <div className="pr-insight" key={index}>
                <span className="pr-insight-ico" style={TONE_STYLE[item.tone] || TONE_STYLE.info}>
                  <i className={`bi ${item.icon}`} />
                </span>
                <div className="pr-insight-text">{item.text}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </section>
  );
}

/* ================================================================== 业务线 */

function DistLegend({ items, unclassified, colorMap, total }) {
  const rows = items.filter((item) => item.hasData || item.value > 0);
  return (
    <div className="pr-legend">
      {rows.map((item) => (
        <div className="pr-legend-row" key={item.key}>
          <span className="pr-legend-dot" style={{ background: colorMap[item.key] }} />
          <span className="pr-legend-name">
            {item.label}
            {item.games != null && <span style={{ color: '#A7B0B8' }}> · {item.games} 款</span>}
          </span>
          <span className="pr-legend-val">{fmtCompact(item.value)}</span>
          <span className="pr-legend-share">{item.share == null ? '—' : `${(item.share * 100).toFixed(1)}%`}</span>
        </div>
      ))}
      {unclassified?.length > 0 && (
        <div className="pr-legend-row" key="unclassified">
          <span className="pr-legend-dot" style={{ background: '#D5DBE0' }} />
          <span className="pr-legend-name" title="未归类的 distribution_type，不计入三类占比的分母">
            未分类 <span style={{ color: '#A7B0B8' }}>· 不计占比</span>
          </span>
          <span className="pr-legend-val">{fmtCompact(unclassified.reduce((sum, item) => sum + item.value, 0))}</span>
          <span className="pr-legend-share">—</span>
        </div>
      )}
      {total != null && (
        <div className="pr-legend-row" style={{ borderTop: '1px solid #F1F4F6', paddingTop: 6 }}>
          <span />
          <span className="pr-legend-name" style={{ color: '#8A959E' }}>
            三类合计
          </span>
          <span className="pr-legend-val">{fmtCompact(total)}</span>
          <span className="pr-legend-share">100%</span>
        </div>
      )}
    </div>
  );
}

const DIST_COLORS = ['#5C7F8E', '#7E9B84', '#B99B72'];

/**
 * 采集兜底占比。接口有两种口径，语义完全不同，文案必须跟着口径走：
 *   placeholderPlayerRatio —— 兜底贡献人数 / 该分型在线人数（人数口径，结论最直观）
 *   placeholderRatio       —— 取到兜底值的 app-小时 / 该分型总 app-小时（数据质量口径）
 * 两者会差很多（W46 商业游戏：行 43% vs 人数 14.9%），所以不能共用一句话。
 * 只认真正的数字且 > 0.5；null / 0 都不算（0 不能被当成缺值吞掉）。
 */
/** 上游对低体量游戏统一回的人员下限（哨兵值），据数据侧核算就是 100 */
const ONLINE_SENTINEL = 100;

function placeholderPeak(items) {
  const rows = (items || []).filter((item) => typeof item.placeholderRatio === 'number');
  const players = (items || []).filter((item) => typeof item.placeholderPlayerRatio === 'number');
  if (!rows.length && !players.length) return null;

  // 「最坏的分型」按人数口径挑（是否可信就是看人数被稀释多少）；
  // 没有人人口径时才按行口径挑。绝不能写死分型名——W46 是独立小游戏，W45 是 Maker。
  const worstRow = players.length
    ? players.reduce((a, b) => (b.placeholderPlayerRatio > a.placeholderPlayerRatio ? b : a))
    : rows.length
      ? rows.reduce((a, b) => (b.placeholderRatio > a.placeholderRatio ? b : a))
      : null;
  const rowRatio = worstRow && typeof worstRow.placeholderRatio === 'number' ? worstRow.placeholderRatio : null;
  const playerRatioExact = worstRow && typeof worstRow.placeholderPlayerRatio === 'number' ? worstRow.placeholderPlayerRatio : null;

  // 人数口径：接口给了就直用；否则用「兜底款数 × 哨兵值 / 该分型在线」估算
  let playerRatio = playerRatioExact;
  let approx = false;
  if (playerRatio == null && worstRow && worstRow.gameCnt && worstRow.peakOnlinePlayers) {
    const sentinelGames = Math.round(rowRatio * worstRow.gameCnt);
    if (sentinelGames > 0 && worstRow.peakOnlinePlayers > 0) {
      playerRatio = (sentinelGames * ONLINE_SENTINEL) / worstRow.peakOnlinePlayers;
      approx = true;
    }
  }

  // 是否提示看「人数口径」——占比会被兜底稀释多少，人数口径才是直接指标；
  // 人数口径缺失（老接口/拼接口径）时才退回行口径。
  const rowsHigh = rowRatio != null && rowRatio > 0.5;
  const playersHigh = playerRatio != null && playerRatio > 0.5;
  const shouldWarn = playerRatio != null ? playersHigh : rowsHigh;
  if (!shouldWarn) return null;
  return { rowRatio, playerRatio, approx, worstRow, rowsHigh, playersHigh };
}

/**
 * 兜底提示文案。百分比必须和口径对齐：
 * 「款数 / app-小时」用 placeholderRatio；「人数」只能用人数口径（接口值或推导值，推导加「约」）。
 */
function placeholderNoteText(info, extra = '', { withPlayers = true, withCounts = true, window = 'hour' } = {}) {
  const label = info.worstRow?.label || '该分型';
  const parts = [];
  if (info.rowsHigh && info.worstRow) {
    if (withCounts) {
      // 同小时快照：gameCnt 是该小时这款分型的款数，反推「多少款是哨兵值」是恒等换算
      const games = info.worstRow.gameCnt;
      const sentinelGames = games ? Math.round(info.rowRatio * games) : null;
      parts.push(
        `${label}${games ? ` ${games} 款里 ` : ' '}${sentinelGames ?? ''}${sentinelGames ? ' 款' : ''}（${(info.rowRatio * 100).toFixed(0)}% 的记录）为源端哨兵值 ${ONLINE_SENTINEL}`
      );
    } else {
      // 并列视图：分母是 app-小时、分子是「款 × 小时」，不能反推款数，只说比例
      parts.push(
        `${label}全周约 ${(info.rowRatio * 100).toFixed(0)}% 的记录为源端哨兵值 ${ONLINE_SENTINEL}（按行计）`
      );
    }
  }
  if (withPlayers && info.playersHigh && withCounts) {
    const peak = info.worstRow?.peakOnlinePlayers;
    // 接口的 placeholderPlayers 是整数口径的「兜底贡献人数」（SUM(值 where 哨兵)），优先用它：
    // 精确、不依赖「哨兵=100」，也没有 ±1 取整误差；没有这个字段时才用 占比×总数 反推并标「约」。
    const exactPlayers = typeof info.worstRow?.placeholderPlayers === 'number' ? info.worstRow.placeholderPlayers : null;
    const sentinelPlayers = exactPlayers ?? (peak ? Math.round(info.playerRatio * peak) : null);
    const approximate = exactPlayers == null;
    const rest = peak != null && sentinelPlayers != null ? peak - sentinelPlayers : null;
    parts.push(
      `按人数计${approximate ? '约' : ''} ${peak ? `${fmtFull(peak)} 人里 ${fmtFull(sentinelPlayers)} 人` : ''}（${(info.playerRatio * 100).toFixed(1)}%）来自这些哨兵值`
    );
    if (rest != null && rest >= 0) {
      // 100 对小体量游戏是偏高填充（剔除后约 56 人/款），所以含兜底的那个数是上限，不是下限
      parts.push(`该分型 ${fmtFull(peak)} 人应视为上限，扣除哨兵值后余${approximate ? '约' : ''} ${fmtFull(rest)} 人`);
    }
  }
  if (withPlayers && !withCounts && info.playersHigh && info.playerRatio != null) {
    parts.push(`按整期在线人数计约 ${(info.playerRatio * 100).toFixed(0)}% 来自哨兵值（含兜底的人数是上限）`);
  }
  const head = parts.length ? parts.join('；') : '含采集兜底值';
  const caveat = parts.length > 1 ? '两个百分比口径不同（款数 / 人数），不要互相换算；' : '';
  return `含采集兜底值：${head}。${caveat}分型占比只作方向参考${extra}。`;
}

/** 峰值小时的同一时刻快照：三类相加严格等于总数，可以画堆叠（接口给了才画） */
function PeakHourBreakdown({ peakHour }) {
  const items = peakHour.breakdown || [];
  const total = peakHour.peakOnlinePlayers || 0;
  const sum = peakHour.sumPeakOnlinePlayers || 0;
  return (
    <>
      <div className="pr-stack" role="img" aria-label="峰值小时在线分型">
        {items.map((item, index) => (
          <span
            key={item.distributionType}
            style={{
              width: `${total ? ((item.peakOnlinePlayers || 0) / total) * 100 : 0}%`,
              background: DIST_COLORS[index % DIST_COLORS.length],
            }}
            title={`${item.label} ${fmtFull(item.peakOnlinePlayers)} 人 / ${item.gameCnt ?? '—'} 款`}
          />
        ))}
      </div>
      <div className="pr-legend">
        {items.map((item, index) => (
          <div className="pr-legend-row" key={item.distributionType}>
            <span className="pr-legend-dot" style={{ background: DIST_COLORS[index % DIST_COLORS.length] }} />
            <span className="pr-legend-name">
              {item.label}
              {item.gameCnt != null && <span style={{ color: '#A7B0B8' }}> · {item.gameCnt} 款</span>}
            </span>
            <span className="pr-legend-val">{fmtCompact(item.peakOnlinePlayers)}</span>
            <span className="pr-legend-share">
              {total ? `${(((item.peakOnlinePlayers || 0) / total) * 100).toFixed(1)}%` : '—'}
            </span>
          </div>
        ))}
        <div className="pr-legend-row" style={{ borderTop: '1px solid #F1F4F6', paddingTop: 6 }}>
          <span />
          <span className="pr-legend-name" style={{ color: '#8A959E' }}>
            同一小时合计
          </span>
          <span className="pr-legend-val">{fmtCompact(sum)}</span>
          <span className="pr-legend-share">100%</span>
        </div>
      </div>
      <div className="pr-breakdown-note" style={{ lineHeight: 1.65 }}>
        {String(peakHour.crawledAt || '').length === 13 ? `${peakHour.crawledAt}:00` : (peakHour.crawledAt || '').slice(0, 16)} 这一小时的快照：{fmtFull(total)} 人 / {peakHour.gameCnt ?? '—'} 款，
        三类可相加
        {peakHour.sumsMatch === false ? '（明细合计与总数不一致，接口已标红）' : ''}。
      </div>
      {placeholderPeak(items) && (
        <div className="pr-breakdown-note" style={{ lineHeight: 1.65, color: '#9A7A35' }}>
          <i className="bi bi-exclamation-triangle" style={{ marginRight: 4 }} />
          {placeholderNoteText(placeholderPeak(items), '；榜单均值已剔除兜底小时')}
        </div>
      )}
    </>
  );
}

export function LineBand({ line }) {
  const meta = LINE_META[line.key] || LINE_META.download;
  const breakdown = line.breakdown;
  const isOnline = line.key === 'online';
  const items = breakdown?.items || [];
  const sum = items.reduce((acc, item) => acc + (item.value || 0), 0);
  const maxItem = Math.max(...items.map((item) => item.value || 0), 1);
  const consistent = breakdown?.consistency?.consistent;

  return (
    <Panel className="pr-line">
      <PanelHead
        color={meta.color}
        icon={meta.icon}
        title={meta.label}
        sub={`${line.kpis.length} 个指标 · 更新于 ${fmtDateTime(line.updatedAt) || '—'}`}
        right={
          breakdown && (() => {
            const c = breakdown.consistency || {};
            // summable=false：分型各自取周内峰值、峰值不在同一小时，相加必然大于总量，
            // 这时不能挂「口径一致」当作可相加的暗示，要明确写「不可相加」并说明去哪看占比
            if (c.summable === false) {
              return (
                <span className="pr-consistency is-note" title={c.note || '分型峰值不在同一小时，相加不等于总量'}>
                  <i className="bi bi-slash-circle" />
                  分型不可相加 · 看峰值小时
                </span>
              );
            }
            return (
              <span
                className={`pr-consistency${consistent ? '' : ' is-warn'}`}
                title={c.note || (consistent ? '分型合计与汇总行一致' : `汇总 ${fmtFull(c.allValue)} vs 分型合计 ${fmtFull(c.detailTotal)}（${c.gapPct > 0 ? '+' : ''}${c.gapPct}%）`)}
              >
                <i className={`bi ${consistent ? 'bi-check2-circle' : 'bi-exclamation-circle'}`} />
                {consistent ? '口径一致' : `合计偏差 ${c.gapPct}%`}
              </span>
            );
          })()
        }
      />
      <div className="pr-line-body">
        <div className={`pr-line-metrics${line.kpis.length % 2 === 1 || line.kpis.length > 4 ? ' is-list' : ''}`}>
          {line.kpis.map((kpi) => (
            <div className="pr-metric" key={kpi.key}>
              <div className="pr-metric-label">
                {kpi.label}
                <NoteMark note={kpi.note} />
                <Coverage available={kpi.availablePeriods || []} total={line.periods?.length} />
              </div>
              <div className="pr-metric-row">
                <span className="pr-metric-num" title={`${fmtFull(kpi.value)} ${kpi.unit}`}>
                  {fmtCompact(kpi.value)}
                </span>
                <span className="pr-metric-unit">{kpi.unit}</span>
                <DeltaChip
                  pct={kpi.deltaPct}
                  abs={kpi.deltaAbs}
                  unit={kpi.unit}
                  comparable={kpi.deltaComparable}
                  hasValue={kpi.hasValue}
                  blocked={kpi.deltaBlocked}
                  reason={kpi.unavailableReason}
                  size="sm"
                />
              </div>
            </div>
          ))}
          {isOnline && (
            <div className="pr-metrics-note">
              {line.coverage ? (
                <>
                  采集覆盖：{line.coverage.windowStart}~{line.coverage.windowEnd} 窗口内{' '}
                  {line.coverage.sampleHours}/{line.coverage.expectedSamples} 个采样点（约{' '}
                  {(line.coverage.ratio * 100).toFixed(0)}%）
                  {(() => {
                    // 进行中期且窗口末日未定稿时，缺口可能只是「昨天还没同步」，不按采集故障表述
                    const pending = line.coverage.gap && line.coverage.windowEndFinal === false;
                    const tone = line.coverage.gap && !pending ? '#9A7A35' : '#8A959E';
                    const ratio = line.coverage.ratio;
                    const text = !line.coverage.gap
                      ? ratio != null && ratio < 0.999
                        ? '，缺口在阈值内（≥90%）'   // 有少量缺口但没到告警线，别说成「完整」
                        : '，窗口内完整'
                      : pending
                        ? '，窗口末尚未定稿（可能只是日更同步延迟），缺口仅作参考'
                        : '，窗口内采集有缺失';
                    return <span style={{ color: tone }}>{text}</span>;
                  })()}
                  {line.coverage.periodRatio != null && (
                    <>
                      ；期口径 {line.coverage.sampleHours}/{line.coverage.periodExpectedSamples}（约{' '}
                      {(line.coverage.periodRatio * 100).toFixed(0)}%
                      {line.coverage.sourceStartsLate ? '，含期初无源的日子' : ''}，只作参考）
                    </>
                  )}
                  {line.coverage.sourceStartsLate && `；在线数据自 ${line.coverage.sourceStart} 起才有，更早日期无源数据`}
                  。
                </>
              ) : (
                <>在线链路目前只有 {line.periods?.length || 0} 期，采集密度为每 2 小时一次（每周 84 个采样点）。</>
              )}
              「本周去重款数」与「峰值小时同时在线款数」是两个口径，不可相减。
            </div>
          )}
        </div>

        <div className="pr-breakdown">
          <div className="pr-breakdown-head">
            <span className="pr-breakdown-title">
              分型拆解 · {isOnline ? '在线峰值' : line.key === 'ad' ? '广告曝光' : '下载量'}
            </span>
            <span className="pr-breakdown-note">{isOnline ? (line.peakHour ? '同一小时 · 可相加' : '并列展示') : '按占比'}</span>
          </div>

          {isOnline ? (
            line.peakHour ? (
              <PeakHourBreakdown peakHour={line.peakHour} />
            ) : (
              <>
                <div className="pr-groupbars">
                  {items.map((item, index) => (
                    <div className="pr-groupbar-row" key={item.key}>
                      <span style={{ color: '#5C6873' }}>{item.label}</span>
                      <span className="pr-groupbar-track">
                        <span
                          className="pr-groupbar-fill"
                          style={{ width: `${Math.max((item.value / maxItem) * 100, 1.5)}%`, background: DIST_COLORS[index % DIST_COLORS.length] }}
                        />
                      </span>
                      <span className="pr-groupbar-val">
                        {fmtCompact(item.value)}
                        <small>{fmtPct(item.deltaPct) || '上期无数据'}</small>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="pr-breakdown-note" style={{ lineHeight: 1.65 }}>
                  各分型峰值出现在不同时刻，相加 {fmtFull(breakdown?.consistency?.detailTotal)} 与总峰值{' '}
                  {fmtFull(breakdown?.consistency?.allValue)} 不同 —— 只并列展示，不做堆叠与占比。
                </div>
                {placeholderPeak(items) && (
                  <div className="pr-breakdown-note" style={{ lineHeight: 1.65, color: '#9A7A35' }}>
                    <i className="bi bi-exclamation-triangle" style={{ marginRight: 4 }} />
                    {placeholderNoteText(placeholderPeak(items), '；排名与均值同样只作方向参考', { withPlayers: true, withCounts: false, window: 'period' })}
                  </div>
                )}
              </>
            )
          ) : (
            <>
              <div className="pr-stack" role="img" aria-label="分型占比">
                {items.map((item, index) => (
                  <span
                    key={item.key}
                    style={{
                      width: `${sum ? (item.value / sum) * 100 : 0}%`,
                      background: DIST_COLORS[index % DIST_COLORS.length],
                    }}
                    title={`${item.label} ${fmtFull(item.value)}（${item.share == null ? '—' : (item.share * 100).toFixed(1) + '%'}）`}
                  />
                ))}
              </div>
              <DistLegend items={items} unclassified={breakdown?.unclassified} colorMap={{ 0: DIST_COLORS[0], 1: DIST_COLORS[1], 2: DIST_COLORS[2] }} total={breakdown?.total} />
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

/* ================================================================== 按游戏 */

export function PlayerCards({ players, flags }) {
  if (!players?.length) return null;
  return (
    <div className="pr-players">
      {players.map((player) => {
        const jump = (flags || []).find((f) => f.item === `${player.key}_download_jump`);
        return (
          <Panel key={player.key}>
            <div className="pr-player-head">
              <span className="pr-panel-icon" style={{ color: '#6B5B86', background: '#F1EEF7' }}>
                <i className="bi bi-controller" />
              </span>
              <div>
                <div className="pr-player-name">{player.name}</div>
                <div className="pr-player-sub">XD 重点游戏 · 概览周表口径</div>
              </div>
            </div>
            <div className="pr-player-body">
              <div className="pr-player-cell">
                <div className="pr-player-cell-main">
                  <div className="pr-player-cell-label">本周下载量</div>
                  <div className="pr-player-cell-value">
                    {fmtCompact(player.download)}
                    <small>次</small>
                  </div>
                  <div className="pr-player-cell-delta">
                    <DeltaChip pct={player.downloadDeltaPct} hasValue={player.download != null} size="sm" />
                  </div>
                </div>
                <div className="pr-player-spark">
                  <Sparkline points={player.downloadTrend || []} color="#7E9B84" height={40} />
                </div>
              </div>
              <div className="pr-player-cell">
                <div className="pr-player-cell-main">
                  <div className="pr-player-cell-label">周均在线</div>
                  <div className="pr-player-cell-value">
                    {fmtCompact(player.avgOnline)}
                    <small>人</small>
                  </div>
                  <div className="pr-player-cell-delta">
                    <DeltaChip pct={player.avgOnlineDeltaPct} hasValue={player.avgOnline != null} size="sm" />
                  </div>
                </div>
                <div className="pr-player-spark">
                  <Sparkline points={player.avgOnlineTrend || []} color="#5C7F8E" height={40} />
                </div>
              </div>
            </div>
            {jump && (
              <div className="pr-flag-inline">
                <i className="bi bi-exclamation-triangle" />
                <span>
                  {jump.detail}。趋势图上单独看待，不与正常期并排比较。
                </span>
              </div>
            )}
          </Panel>
        );
      })}
    </div>
  );
}

/* ================================================================== 榜单 */

const RANK_CATEGORIES = [
  { key: 'top', label: '总量' },
  { key: 'gain', label: '增量' },
  { key: 'loss', label: '下滑' },
];

const ONLINE_LISTS = [
  { key: 'dist_0', label: '商业游戏' },
  { key: 'dist_1', label: '独立小游戏' },
  { key: 'dist_2', label: 'Maker 小游戏' },
];

/** W45 起才改成按 distribution_type 分榜；之前的历史周只有这三个旧维度 */
const ONLINE_LISTS_RETIRED = [
  { key: 'pc_played', label: 'PC' },
  { key: 'pc_emulator_played', label: 'PC 模拟器' },
  { key: 'app_hot_creative', label: '小游戏' },
];

/** 该期在线榜用的是哪套维度（周报按 ISO 周号比较，月报 2026-10 也属于旧维度区间） */
function onlineListSet(periodType, periodKey) {
  if (!periodKey) return ONLINE_LISTS;
  if (periodType === 'monthly') {
    const [y, m] = String(periodKey).split('-').map(Number);
    return y === 2026 && m <= 10 ? ONLINE_LISTS_RETIRED : ONLINE_LISTS;
  }
  return String(periodKey) < '2026-45' ? ONLINE_LISTS_RETIRED : ONLINE_LISTS;
}

function RankIcon({ src, name }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <span className="pr-rank-icon-fallback">{(name || '?').slice(0, 1)}</span>;
  }
  return (
    <img
      className="pr-rank-icon"
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function rankValueText(value) {
  if (value == null) return '—';
  return Math.abs(value) < 100000 ? fmtFull(value) : fmtCompact(value);
}

export function RankCard({ line, periodType, periodKey, distLabels, flags, isPartial, coverage }) {
  const meta = LINE_META[line] || LINE_META.download;
  const listSet = line === 'online' ? onlineListSet(periodType, periodKey) : null;
  const [category, setCategory] = useState('top');
  const [listType, setListType] = useState(listSet ? listSet[0].key : undefined);

  // 换期次时维度集合会变（W44 及之前是旧维度），同步切回该期的第一项
  useEffect(() => {
    if (listSet) setListType(listSet[0].key);
  }, [listSet]);

  const rankQuery = useQuery({
    queryKey: ['pr-rank', line, periodType, periodKey, category, listType],
    queryFn: () => fetchRank(line, { periodType, key: periodKey, category, limit: 8, listType }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const data = rankQuery.data;
  let items = data?.items || [];
  const duplicatedRank = items.filter((item) => item.rankNo === 1).length > 2;
  if (duplicatedRank) {
    items = [...items].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  }
  // 不再用「数值全相同」判占位/隐藏：数据修好时它碰巧正确，遇到真实同值榜就会静默消失。
  // 可比性交给接口（58714b5 的 sample.lowSample，阈值常量在服务端），前端只渲染信号。
  const distinctValues = new Set(items.map((item) => item.value));
  const allTied = items.length >= 3 && distinctValues.size === 1;
  // 只有真拿到行级 realHours 才敢说「样本不足」——后端 58714b5 曾经因为 real_hours 没落库
  // 返回过全 null，这时 lowSample 即使为 true 也没有可见依据，宁可不提示也不能凭空报警。
  const hoursKnown = items.filter((item) => typeof item.realHours === 'number');
  const sample = data?.sample || null;
  // 覆盖不全的期（如 W45 只有 11-08 一天 8 小时）已有一条 online_partial_coverage 说明，
  // 再叠「样本不足」等于同一个问题说两遍，按后端建议只留覆盖那条。
  // 注意 flag 在后续期也会返回（W46 的响应里同样带「2026-45 只采集到 8/84 小时」），
  // 所以必须确认它讲的是**当前期**，否则会把 W46 合法的低样本提示一起吞掉。
  const periodKeyOfFlag = (f) => {
    const m = String(f.detail || '').match(/\d{4}-\d{2}/);
    return m ? m[0] : null;
  };
  // 优先用接口给的 scope（current / previous），它把「谁的原因」钉死了；
  // 老接口没有 scope 时才退回「detail 里提到的期次 == 当前期」这种字符串判断。
  // 首选接口的 lines[online].coverage.gap（窗口内是否真有洞），没有这个结构时退回 flag 判断
  const coverageWarned =
    typeof coverage?.gap === 'boolean'
      ? coverage.gap === true
      : (flags || []).some((f) => {
          if (!String(f.item || '').endsWith('_partial_coverage')) return false;
          if (f.scope) return f.scope === 'current';
          return periodKeyOfFlag(f) === String(periodKey);
        });
  // 展示层规则：覆盖不全（flag 指当前期）或本期未走完时，不再叠「样本不足」——
  // 这两种情况本来就已经有更强的说明（覆盖不全 / 进行中），W47 首日那种 max<10 是正常现象。
  const suppressed = line === 'online' && (coverageWarned || isPartial === true);
  const lowSample = sample?.lowSample === true && hoursKnown.length > 0 && !suppressed;
  const hoursList = hoursKnown.length ? hoursKnown.map((item) => item.realHours) : [];
  const sampleMin = sample && typeof sample.minRealHours === 'number' ? sample.minRealHours : hoursList.length ? Math.min(...hoursList) : null;
  const sampleMax = sample && typeof sample.maxRealHours === 'number' ? sample.maxRealHours : hoursList.length ? Math.max(...hoursList) : null;
  const sampleMedian = sample && typeof sample.medianRealHours === 'number' ? sample.medianRealHours : null;
  const sampleText =
    sampleMin == null && sampleMax == null
      ? null
      : `有效在线小时${sampleMedian != null ? `：中位 ${sampleMedian}h` : ''}${sampleMin != null ? ` · 最少 ${sampleMin}h` : ''}${
          sampleMax != null ? ` · 最多 ${sampleMax}h` : ''
        }`;

  return (
    <Panel>
      <div className="pr-rank-head">
        <span className="pr-panel-icon" style={{ color: meta.color, background: `${meta.color}14` }}>
          <i className={`bi ${meta.icon}`} />
        </span>
        <div>
          <div className="pr-rank-head-title">{meta.short}榜</div>
          <div className="pr-rank-head-sub">
            {data?.availableRows != null ? `${data.availableRows} 条 · ${RANK_CATEGORIES.find((c) => c.key === category)?.label}` : '加载中…'}
          </div>
        </div>
        <div className="pr-rank-switch">
          {RANK_CATEGORIES.map((item) => (
            <button
              key={item.key}
              type="button"
              className={item.key === category ? 'is-active' : ''}
              onClick={() => setCategory(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {line === 'online' && listSet && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px 0', flexWrap: 'wrap' }}>
          {listSet.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setListType(item.key)}
              className="pr-source-chip"
              style={
                listType === item.key
                  ? { background: `${meta.color}16`, color: meta.color, fontWeight: 600, border: 0 }
                  : { background: '#F5F8F9', color: '#8A959E', border: 0, cursor: 'pointer' }
              }
            >
              {distLabels?.[item.key.replace('dist_', '')] || item.label}
            </button>
          ))}
          {data?.retiredDimension && (
            <span
              className="pr-chip is-empty"
              title="W45 起在线榜改为按分发类型（dist_0/1/2）分榜；这一期只有旧维度行（is_active=0 的历史数据），仅作回看"
            >
              旧维度 · 仅历史期
            </span>
          )}
        </div>
      )}

      {lowSample && (
        <div className="pr-rank-notice">
          <i className="bi bi-exclamation-circle me-1" />
          样本不足 · 名次仅作参考{sampleText ? `：${sampleText}` : ''}，
          多数游戏只有几个小时有真值，均值区分度有限。
        </div>
      )}

      {allTied && !lowSample && (
        <div className="pr-rank-notice">
          <i className="bi bi-info-circle me-1" />
          该维度 {items.length} 条记录数值相同（{rankValueText(items[0].value)}），是真实并列，按源表名次展示。
        </div>
      )}

      {duplicatedRank && (
        <div className="pr-rank-notice">
          <i className="bi bi-exclamation-circle me-1" />
          排名列异常：{items.length} 条记录并列第 1（源表 rank_no 未展开），已改按数值降序展示，名次仅作参考。
        </div>
      )}

      <div className="pr-rank-list">
        {rankQuery.isLoading && <Placeholder height={140} icon="bi-hourglass-split">加载榜单…</Placeholder>}
        {rankQuery.error && (
          <div className="pr-rank-empty" style={{ color: '#B4483F' }}>
            榜单读取失败：{rankQuery.error.message}
          </div>
        )}
        {!rankQuery.isLoading && !rankQuery.error && items.length === 0 && (
          <div className="pr-rank-empty">本期该维度暂无榜单数据</div>
        )}
        {items.map((item, index) => {
          const main = category === 'top' ? item.value : item.diff;
          const pct = item.diffPct;
          const tone = pct == null ? 'flat' : pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
          const subText =
            category === 'top'
              ? fmtPct(pct) || '上期无数据'
              : `总量 ${rankValueText(item.value)}`;
          return (
            <div
              className={`pr-rank-row${!duplicatedRank && item.rankNo <= 3 ? ` is-top${item.rankNo}` : ''}`}
              key={`${item.appId}-${item.rankNo}`}
              title={item.tags?.length ? item.tags.join(' / ') : undefined}
            >
              <span className="pr-rank-no">{duplicatedRank ? index + 1 : item.rankNo ?? '—'}</span>
              <RankIcon src={item.icon} name={item.appName} />
              <div style={{ minWidth: 0 }}>
                <div className="pr-rank-name">
                  {item.appName || '—'}
                  {item.distributionLabel && (
                    <span style={{ color: '#A7B0B8', fontSize: 9.5, marginLeft: 5 }}>{item.distributionLabel}</span>
                  )}
                </div>
                <div className="pr-rank-tags">{item.tags?.join(' · ') || '—'}</div>
              </div>
              <div className="pr-rank-value">
                {rankValueText(main)}
                <small className={`is-${category === 'top' ? tone : 'flat'}`}>
                  {subText}
                  {item.realHours != null && (
                    <span
                      style={{ color: '#A7B0B8', marginLeft: 5 }}
                      title={`本周期仅 ${item.realHours} 个有效在线小时参与均值（有效小时越少，名次越不稳）`}
                    >
                      · {item.realHours}h
                    </span>
                  )}
                </small>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export function RankGrid({ periodType, periodKey, distLabels, flags, isPartial, coverage }) {
  return (
    <div className="pr-ranks">
      {['download', 'ad', 'online'].map((line) => (
        <RankCard
          key={line}
          line={line}
          periodType={periodType}
          periodKey={periodKey}
          distLabels={distLabels}
          flags={flags}
          isPartial={isPartial}
          coverage={coverage}
        />
      ))}
    </div>
  );
}

/* ================================================================== 数据质量 */

export function QualitySection({ report }) {
  const { flags = [], meta } = report;
  return (
    <div className="pr-quality">
      <Panel>
        <PanelHead color="#9A7A35" icon="bi-shield-check" title="数据质量标注" sub="接口直接给出，前端只标注不修改数据" />
        <div className="pr-flag-list">
          {flags.length === 0 && <Placeholder height={100}>本期无质量标注</Placeholder>}
          {flags.map((flag) => {
            const level = LEVEL_META[flag.level] || LEVEL_META.info;
            return (
              <div className="pr-flag" key={flag.item}>
                <span className="pr-flag-level" style={{ color: level.color, background: level.bg }}>
                  {level.label}
                </span>
                <div>
                  <div className="pr-flag-label">{flag.label}</div>
                  <div className="pr-flag-detail">{flag.detail}</div>
                  {flag.action && <div className="pr-flag-action">处理：{flag.action}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel>
        <PanelHead color="#3F6B8F" icon="bi-info-circle" title="口径说明" sub="新版报表只依赖存活表" />
        <div className="pr-notes">
          <div>
            <div className="pr-note-block-title">取数规则</div>
            <div className="pr-note-block-text">
              三条业务线均取周期表 <code>category_type='all'</code> 汇总行；分型取 <code>category_type='dist'</code>。
              广告为 v6 口径（<code>total_views = ad_views + pcebid_views</code>），PC 在线榜 W45 起按{' '}
              <code>dist_0/1/2</code> 分维度。榜单统一过滤 <code>is_active = 1</code>。
            </div>
          </div>
          <div>
            <div className="pr-note-block-title">缺值规则</div>
            <div className="pr-note-block-text">
              某指标某期没有数据就显示「—」，不补 0、不回溯更早的期算环比；可用期数不足 3 期的指标不画趋势线。
              本期未走完时数值是累计进度，环比只作参考。
            </div>
          </div>
          <div>
            <div className="pr-note-block-title">兜底值说明</div>
            <div className="pr-note-block-text">
              在线人数源端对低体量游戏统一回 <code>100</code>（哨兵值）：按 <code>app-小时</code> 计，
              独立小游戏 / Maker 分型里过半时段都是这个值，商业游戏约四成。
              接口的 <code>placeholderRatio</code> 是「按行计」的数据质量比例，<b>不等于在线人数里的兜底占比</b>
              （W46 商业游戏：按行 43%、按人数 15%），所以分型占比只作方向参考；
              榜单均值已剔除兜底小时，整周期全为兜底值时该维度不出榜。
            </div>
          </div>
          <div>
            <div className="pr-note-block-title">数据来源</div>
            <div className="pr-chip-list">
              {(meta.sources || []).map((table) => (
                <span className="pr-source-chip" key={table}>
                  {table}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="pr-note-block-title">已下线字段（不再展示、不占位）</div>
            <div className="pr-chip-list">
              {(meta.retiredColumns || []).map((column) => (
                <span className="pr-source-chip is-retired" key={column}>
                  {column}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
