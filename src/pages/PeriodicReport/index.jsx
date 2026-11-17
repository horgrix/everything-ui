import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchPeriods, fetchReport, fetchReserve } from '../../api/periodic';
import { withCoreKpis, withLineLabels } from './coreKpis';
import { buildDownloadTrend, useSmallGameSeries, withSmallGame } from './distSeries';
import { normalizeReserve } from './reserve';
import { ReserveSection } from './ReserveSection';
import { Panel, Placeholder, fmtCutoff, fmtDateTime } from './prKit';
import {
  Cover,
  DownloadTrend,
  KpiGrid,
  LineBand,
  PlayerCards,
  QualitySection,
  RankCard,
  TrendSection,
} from './Sections';
import './periodic.css';

const TABS = [
  { key: 'weekly', label: '周报' },
  { key: 'monthly', label: '月报' },
];

/** 区块头：序号 + 标题 + 说明（报告式排版的小节标题） */
function SectionHead({ no, title, sub, right }) {
  return (
    <>
      <div className="pr-section-head">
        <div className="pr-section-title">
          <span className="pr-section-no">{no}</span>
          {title}
          {sub && <span className="pr-section-sub">{sub}</span>}
        </div>
        {right && <div className="pr-section-sub">{right}</div>}
      </div>
    </>
  );
}

function LoadingView() {
  return (
    <>
      <div className="pr-skeleton" style={{ height: 178, marginTop: 20, borderRadius: 20 }} />
      <div className="pr-kpi-grid" style={{ marginTop: 18 }}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="pr-skeleton" key={index} style={{ height: 150 }} />
        ))}
      </div>
      <div className="pr-skeleton" style={{ height: 260, marginTop: 26 }} />
    </>
  );
}

/**
 * 定期报告（周报 / 月报）
 *
 * 一个期次一篇「刊」：
 *   封面（两个主数字 + 本期状态）→ 6 个核心指标卡（三款数 + 三总量，环比 + 迷你趋势）→ 趋势图 + 本期要点
 *   → 三条业务线明细（分型拆解）→ 重点游戏 → 榜单 → 数据质量与口径。
 *
 * 所有取值 / 上期 / 环比 / 可用期数 / 质量标记都来自 everything-api 的
 * `GET /api/v09/data/periodic/{periods,report,rank}`，页面不再直连数据库。
 */
export default function PeriodicReport() {
  const [params, setParams] = useSearchParams();
  const periodType = params.get('period') === 'monthly' ? 'monthly' : 'weekly';
  const keyParam = params.get('key') || undefined;

  const periodsQuery = useQuery({
    queryKey: ['pr-periods', periodType],
    queryFn: () => fetchPeriods(periodType),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const reportQuery = useQuery({
    queryKey: ['pr-report', periodType, keyParam || 'latest'],
    queryFn: () => fetchReport(periodType, keyParam),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // 核心指标读哪 6 个数由 coreKpis.js 的口径清单定序（三款数 + 三总量），其余区块照用接口原值
  const report = useMemo(() => withCoreKpis(withLineLabels(reportQuery.data)), [reportQuery.data]);
  const meta = report?.meta;

  // 下载结构趋势（总量 / APP / PC / 小游戏）：小游戏逐期值接口暂未直接给，按需补拉各期
  const downloadPeriods = useMemo(
    () =>
      (report?.lines?.find((line) => line.key === 'download')?.kpis?.find((kpi) => kpi.key === 'download_total')?.trend || [])
        .filter((point) => point.value != null)
        .map((point) => point.period),
    [report]
  );
  const smallGame = useSmallGameSeries(report, periodType, downloadPeriods);
  const downloadTrend = useMemo(() => buildDownloadTrend(report, smallGame), [report, smallGame]);
  const view = useMemo(() => withSmallGame(report, downloadTrend), [report, downloadTrend]);
  // 预约：优先用 /report 里的 reserve 块（一篇报告一次请求拿全）；后端若改成独立接口，
  // meta.reserveAvailable = true 时再补一次请求。两种都没有 → 这一节不出现，页面与改造前一致。
  const reserveInline = reportQuery.data?.reserve || null;
  const reserveQuery = useQuery({
    queryKey: ['pr-reserve', periodType, keyParam || 'latest'],
    queryFn: () => fetchReserve(periodType, keyParam),
    enabled: !reserveInline && reportQuery.data?.meta?.reserveAvailable === true,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 0,
  });
  const reserve = useMemo(
    () => normalizeReserve(reserveInline || reserveQuery.data, { periodType, meta: reportQuery.data?.meta }),
    [reserveInline, reserveQuery.data, periodType, reportQuery.data?.meta]
  );

  const available = meta?.availablePeriods || [];
  const currentKey = meta?.periodKey;
  const currentIndex = available.indexOf(currentKey);
  const prevKey = currentIndex > 0 ? available[currentIndex - 1] : null;
  const nextKey = currentIndex >= 0 && currentIndex < available.length - 1 ? available[currentIndex + 1] : null;

  const listed = periodsQuery.data?.periods || [];
  const options = listed.length ? listed : available.map((key) => ({ key, label: key, lines: {} }));
  const labelOf = (key) => options.find((item) => item.key === key)?.label || key;
  const latestAvailable = periodsQuery.data?.latest || null;

  const gotoPeriod = (key) => {
    const next = new URLSearchParams(params);
    if (key) next.set('key', key);
    else next.delete('key');
    setParams(next, { replace: true });
  };

  const switchType = (type) => {
    const next = new URLSearchParams(params);
    if (type === 'weekly') next.delete('period');
    else next.set('period', type);
    next.delete('key');
    setParams(next, { replace: true });
  };

  const title = periodType === 'weekly' ? 'TapTap 数据周报' : 'TapTap 数据月报';
  const rangeText = meta ? `${meta.periodStart} 至 ${meta.periodEnd}` : '';

  return (
    <div className="pr-page">
      <header className="pr-head">
        <div>
          <div className="pr-overline">TapTap · Periodic Report</div>
          <h1>
            {title}
            {meta && <span className="pr-head-issue">{meta.periodLabel}</span>}
          </h1>
          <div className="pr-head-sub">
            <span>{reserve ? '下载 · 广告 · 在线 · 预约 四条业务线' : '下载 · 广告 · 在线 三条业务线'}</span>
            {rangeText && <span>· {rangeText}</span>}
            {meta?.updatedAt && <span>· 数据更新 {fmtDateTime(meta.updatedAt)}</span>}
            {meta?.isLatest && <span className="pr-coverage">最新一期</span>}
          </div>
        </div>

        <div className="pr-head-actions">
          <div className="pr-seg" role="tablist" aria-label="报告周期">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={tab.key === periodType}
                className={tab.key === periodType ? 'is-active' : ''}
                onClick={() => switchType(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="pr-period">
            <button
              type="button"
              className="pr-icon-btn"
              onClick={() => prevKey && gotoPeriod(prevKey)}
              disabled={!prevKey}
              title={prevKey ? `上一期：${labelOf(prevKey)}` : '已是最早一期'}
              aria-label="上一期"
            >
              <i className="bi bi-chevron-left" />
            </button>
            <select
              value={currentKey || ''}
              onChange={(event) => gotoPeriod(event.target.value)}
              aria-label="选择期次"
            >
              {!currentKey && <option value="">载入中…</option>}
              {options.map((option) => {
                const missing = Object.entries(option.lines || {})
                  .filter(([, has]) => !has)
                  .map(([line]) => line);
                return (
                  <option key={option.key} value={option.key}>
                    {option.label}
                    {missing.length ? `（${missing.length} 条线缺数据）` : ''}
                  </option>
                );
              })}
            </select>
            <button
              type="button"
              className="pr-icon-btn"
              onClick={() => nextKey && gotoPeriod(nextKey)}
              disabled={!nextKey}
              title={nextKey ? `下一期：${labelOf(nextKey)}` : '已是最新一期'}
              aria-label="下一期"
            >
              <i className="bi bi-chevron-right" />
            </button>
          </div>

          <button type="button" className="pr-ghost-btn" onClick={() => window.print()} title="打印或另存为 PDF">
            <i className="bi bi-printer" />
            导出
          </button>
        </div>
      </header>

      {reportQuery.isLoading && <LoadingView />}

      {reportQuery.error?.noData && (
        <Panel style={{ marginTop: 18 }}>
          <div className="pr-empty-state">
            <i className="bi bi-calendar-x d-block mb-2" style={{ fontSize: 22, color: '#A7B0B8' }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: '#3B4750' }}>
              {keyParam || '所选期次'} 这一期还没有数据
            </div>
            <div style={{ fontSize: 11.5, color: '#8A959E', marginTop: 6, lineHeight: 1.7 }}>
              周期表还没生成这一行（周报每周一产出、月报次月产出），不是接口故障；
              指标级的「待生成」只用于「本期已生成、个别指标还没到时间」的情况。
            </div>
            <button
              type="button"
              className="pr-ghost-btn"
              style={{ marginTop: 12 }}
              onClick={() => gotoPeriod(null)}
            >
              查看最新一期{latestAvailable ? `（${labelOf(latestAvailable)}）` : ''}
            </button>
          </div>
        </Panel>
      )}

      {reportQuery.error && !reportQuery.error.noData && (
        <div className="pr-error">
          <i className="bi bi-exclamation-octagon" style={{ fontSize: 15, marginTop: 1 }} />
          <div>
            <b>报告加载失败：</b>
            {reportQuery.error.message}
            <div style={{ marginTop: 6, color: '#8A6A64' }}>
              该接口与站内其它数据接口共用网关登录态；如果没有权限或期次已不存在，请换一期查看。
              {keyParam && (
                <button
                  type="button"
                  className="pr-ghost-btn"
                  style={{ height: 26, padding: '0 10px', marginLeft: 8, fontSize: 11.5 }}
                  onClick={() => gotoPeriod(null)}
                >
                  查看最新一期
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {!reportQuery.isLoading && !reportQuery.error && !report && (
        <Panel style={{ marginTop: 18 }}>
          <Placeholder height={220}>暂无这一期的数据</Placeholder>
        </Panel>
      )}

      {view && (
        <>
          <Cover report={view} periodType={periodType} />

          {meta.isPartial && (
            <div className="pr-banner">
              <i className="bi bi-hourglass-split" style={{ marginTop: 1 }} />
              <span>
                {meta.periodLabel} 尚未走完（{meta.periodStart} 至 {meta.periodEnd}，数据截至 {fmtCutoff(meta)}），
                数值是累计到当前的进度，与上一完整期不可比；环比已标「参考」。
              </span>
            </div>
          )}

          <section className="pr-section">
            <SectionHead
              no="01"
              title="核心指标"
              sub={`每期都看的 ${view.coreKpis.length} 个数`}
              right="趋势点来自同一张业务线周期表，缺值期不补 0"
            />
            <KpiGrid coreKpis={view.coreKpis} totalPeriods={meta.availablePeriods.length} />
          </section>

          <TrendSection report={view} />

          <DownloadTrend trend={downloadTrend} isPartial={meta.isPartial === true} />

          <section className="pr-section">
            <SectionHead
              no="04"
              title="业务线明细"
              sub="左边汇总与分型拆解，右边该业务线榜单"
              right={`更新至 ${fmtDateTime(meta.updatedAt) || '—'}`}
            />
            {view.lines.map((line) => (
              <div className="pr-line-row" key={line.key}>
                <LineBand line={line} isPartial={meta.isPartial === true} />
                <RankCard
                  line={line.key}
                  limit={6}
                  periodType={periodType}
                  periodKey={meta.periodKey}
                  distLabels={meta.distLabels}
                  flags={report.flags}
                  isPartial={meta.isPartial === true}
                  coverage={
                    line.key === 'online' ? line.coverage : null
                  }
                />
              </div>
            ))}
          </section>

          {report.players?.length > 0 && (
            <section className="pr-section">
              <SectionHead
                no="05"
                title="重点游戏"
                sub="XD 单品本周表现"
                right="来源：概览周表，与业务线周期表分开核算"
              />
              <PlayerCards players={report.players} flags={report.flags} />
            </section>
          )}

          {reserve && (
            <section className="pr-section">
              <SectionHead
                no="06"
                title="预约"
                sub="尚未上线游戏的预约热度"
                right="采集 2026-11-08 起，期数不够不出趋势线；日均环比代替总量环比"
              />
              <ReserveSection reserve={reserve} periodType={periodType} />
            </section>
          )}

          <section className="pr-section">
            <SectionHead
              no={reserve ? '07' : '06'}
              title="数据质量与口径"
              sub={`${report.flags.length} 条标注`}
              right="新版报表已不再依赖下线的旧表与旧维度"
            />
            <QualitySection report={report} />
          </section>

          <footer className="pr-footer">
            <span>
              数据接口：everything-api · /api/v09/data/periodic · {meta.periodType === 'weekly' ? '周报' : '月报'}
            </span>
            <span>
              共 {meta.availablePeriods.length} 期可回看 · 窗口 {meta.window} 期 · 数据更新{' '}
              {fmtDateTime(meta.updatedAt) || '—'}
            </span>
          </footer>
        </>
      )}
    </div>
  );
}
