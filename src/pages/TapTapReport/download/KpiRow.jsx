import { formatCompactNumber, formatNumber } from '../../../utils/formatters';

/**
 * 下载统计 KPI 行：今日总下载数 / APP / PC / 小游戏（独立 / Maker 拆分）
 *
 * 今日 = SQLite `dws_taptap_download_v2_hourly` 当天聚合（`transformTodayRealtime`，负增量按 0）；
 * 昨日 / 上周同日 = MySQL v09 `dws_taptap_download_v2_daily`（`transformDaySummary`）。
 * 每张卡都带「昨日」「上周」两个对照值；今日未满一天时只给对照值、不出环比
 * （否则拿「截至 12 时」去比「昨日全天」，环比必然是 -50% 左右的假象）。
 */

/** 6 个 KPI：取今日 / 昨日 / 上周同一天的口径 */
const KPI_DEFS = [
  { key: 'total', label: '今日总下载数', icon: 'bi-download', accent: '#5C6B7A', tint: '#EDF1F5' },
  { key: 'app', label: '今日APP下载数', icon: 'bi-phone', accent: '#3E6E9E', tint: '#EAF1F6' },
  { key: 'pc', label: '今日PC下载数', icon: 'bi-pc-display', accent: '#7D8F7B', tint: '#EEF3EE' },
  { key: 'miniTotal', label: '今日小游戏下载数', icon: 'bi-grid-3x3-gap', accent: '#8A6A33', tint: '#FBF2E7' },
  { key: 'mini', label: '今日独立小游戏下载数', icon: 'bi-puzzle', accent: '#5F4B86', tint: '#F3EFF8' },
  { key: 'tmk', label: '今日Maker小游戏下载数', icon: 'bi-tools', accent: '#8A5A45', tint: '#F6EFEC' },
];

/** 今日口径（transformTodayRealtime：app / pc / nonMaker / maker）→ 与 KPI_DEFS 对齐 */
function todayOf(realtime) {
  if (!realtime) return null;
  const app = Number(realtime.app || 0);
  const pc = Number(realtime.pc || 0);
  const mini = Number(realtime.nonMaker || 0);
  const tmk = Number(realtime.maker || 0);
  return { app, pc, mini, tmk, miniTotal: mini + tmk, total: app + pc };
}

/** 万位以上用「万/亿」，万位以下用千分位，避免 5421 这种小数值没有分隔符 */
const fmt = (v) => (v == null ? '—' : Math.abs(Number(v)) >= 1e4 ? formatCompactNumber(v) : formatNumber(v));

/** 变化率：base 为 0 或缺失时不给百分比 */
function deltaOf(current, base) {
  if (current == null || base == null || base === 0) return null;
  return ((current - base) / base) * 100;
}

function DeltaText({ current, base, label, showPct }) {
  const pct = showPct ? deltaOf(current, base) : null;
  const color = pct == null || Math.abs(pct) < 0.05 ? '#98A2AC' : pct > 0 ? '#C0504D' : '#3F7A5E';
  return (
    <div className="d-flex align-items-center justify-content-between" style={{ fontSize: 11.5 }}>
      <span className="text-muted">{label}</span>
      <span className="d-flex align-items-baseline" style={{ gap: 6 }}>
        <span style={{ color: '#5C6873', fontVariantNumeric: 'tabular-nums' }}>{fmt(base)}</span>
        <span style={{ color, fontWeight: 600, minWidth: 48, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {!showPct ? '' : pct == null ? '—' : `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`}
        </span>
      </span>
    </div>
  );
}

export default function DownloadKpiRow({ realtime, history, loading = false, updateLabel = '' }) {
  const today = todayOf(realtime);
  // 今日是否已走完（小时表最后一个点是 22 时）：未走完只给对照值，不出环比
  const latestHourOfDay = realtime?.latestHour ? Number(String(realtime.latestHour).slice(11, 13)) : null;
  const fullDay = latestHourOfDay != null && latestHourOfDay >= 22;
  const yesterday = history?.yesterday || null;
  const lastWeek = history?.lastWeek || null;

  return (
    <div className="mb-4">
      <div className="d-flex flex-wrap align-items-baseline justify-content-between gap-2 mb-2">
        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#232B33' }}>今日下载概览</div>
        <span className="text-muted small">
          {realtime?.latestHour ? `今日实时截至 ${String(realtime.latestHour).slice(11)} 时 · ` : ''}
          昨日 / 上周同日取 MySQL 日表{updateLabel ? ` · ${updateLabel}` : ''}
          {!fullDay && !loading ? ' · 今日未满一天，只列对照值不出环比' : ''}
        </span>
      </div>

      <div className="row g-3">
        {KPI_DEFS.map((def) => {
          const value = today ? today[def.key] : null;
          return (
            <div className="col-6 col-md-4 col-xl-2" key={def.key}>
              <div className="card border-0 shadow-sm h-100" style={{ background: def.tint, border: `1px solid ${def.accent}1f` }}>
                <div className="card-body d-flex flex-column" style={{ padding: '14px 16px 12px' }}>
                  <div className="d-flex align-items-center" style={{ gap: 7 }}>
                    <span
                      className="d-inline-flex align-items-center justify-content-center flex-shrink-0"
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 8,
                        background: '#fff',
                        color: def.accent,
                        fontSize: 12,
                        boxShadow: '0 1px 2px rgba(16,24,40,0.06)',
                      }}
                    >
                      <i className={`bi ${def.icon}`} />
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#333D45', lineHeight: 1.35 }}>{def.label}</span>
                  </div>

                  <div
                    className="mt-2"
                    style={{
                      fontSize: 24,
                      fontWeight: 650,
                      letterSpacing: -0.6,
                      lineHeight: 1.1,
                      color: loading ? '#B7C0C8' : '#1B2228',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {loading ? '—' : fmt(value)}
                  </div>

                  <div className="mt-2 pt-2" style={{ borderTop: '1px dashed #E7EBEF' }}>
                    <DeltaText current={value} base={yesterday?.[def.key]} label="昨日" showPct={fullDay} />
                    <div style={{ height: 4 }} />
                    <DeltaText current={value} base={lastWeek?.[def.key]} label="上周" showPct={fullDay} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
