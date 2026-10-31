import { useSearchParams } from 'react-router-dom';
import WeekCard from './WeekCard';
import { useWeeklyReport, useActiveStat, buildStatMap } from './data';

/** 周报最多展示的最新期数 */
const MAX_WEEKS = 4;

/** 空态 / 加载态面板样式 */
const PANEL_STYLE = {
  background: '#fff',
  border: '1px solid #EDF0F2',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
  padding: '18px 22px',
  fontSize: 12.5,
};

/** Tab 配置（月报 / 年报的数据源尚未接入） */
const TABS = [
  { key: 'weekly', label: '周报', icon: 'bi-calendar-week' },
  { key: 'monthly', label: '月报', icon: 'bi-calendar-month' },
  { key: 'yearly', label: '年报', icon: 'bi-calendar-range' },
];

/** 未接入的 Tab 占位 */
function PendingTab({ label, table }) {
  return (
    <div style={{ ...PANEL_STYLE, textAlign: 'center', padding: '56px 20px' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#3B4750' }}>{label}数据源尚未接入</div>
      <div style={{ fontSize: 12, color: '#A7B0B8', marginTop: 6 }}>待接入后自动展示：{table}</div>
    </div>
  );
}

export default function PeriodicReport() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'weekly';

  const weeklyQuery = useWeeklyReport();
  const activeQuery = useActiveStat();

  const rows = weeklyQuery.data || [];
  const statMap = buildStatMap(activeQuery.data);

  const updatedAtRaw = rows.find((r) => r.updatedAt)?.updatedAt;
  const updatedAt = updatedAtRaw ? String(updatedAtRaw).replace('T', ' ').slice(0, 16) : null;

  const setTab = (key) => {
    const next = new URLSearchParams(params);
    if (key === 'weekly') next.delete('tab');
    else next.set('tab', key);
    setParams(next, { replace: true });
  };

  return (
    <div className="container-fluid p-4" style={{ maxWidth: 1440, margin: '0 auto' }}>
      {/* 页头 */}
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3">
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.4, color: '#A7B0B8' }}>PERIODIC REPORT</div>
          <h1 style={{ fontSize: 27, fontWeight: 650, letterSpacing: -0.3, color: '#1B2228', margin: '4px 0 0' }}>定期报告</h1>
          <div style={{ fontSize: 12.5, color: '#8A959E', marginTop: 6 }}>
            周报 · 月报 · 年报 概览
            {updatedAt && (
              <span className="ms-2" style={{ color: '#A7B0B8' }}>
                数据更新于 {updatedAt}
              </span>
            )}
          </div>
        </div>
        <a
          href="https://file.horgrix.com/downloads/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            border: '1px solid #E3E8EC',
            background: '#fff',
            color: '#3B4750',
            fontSize: 12.5,
            fontWeight: 500,
            padding: '8px 16px',
            borderRadius: 10,
            textDecoration: 'none',
            boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
          }}
        >
          报告下载中心
          <i className="bi bi-arrow-up-right ms-1" style={{ fontSize: 11 }}></i>
        </a>
      </div>

      {/* 周期切换：胶囊分段控件 */}
      <div
        className="d-inline-flex"
        style={{ background: '#F2F5F7', borderRadius: 12, padding: 4, marginTop: 20, marginBottom: 20 }}
        role="group"
        aria-label="定期报告周期切换"
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                border: 'none',
                background: active ? '#fff' : 'transparent',
                boxShadow: active ? '0 1px 3px rgba(16,24,40,0.10)' : 'none',
                borderRadius: 9,
                padding: '6px 18px',
                fontSize: 12.5,
                fontWeight: active ? 600 : 500,
                color: active ? '#1F272E' : '#71808A',
                cursor: 'pointer',
                transition: 'all .15s',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'weekly' && (
        <>
          {weeklyQuery.error ? (
            <div style={PANEL_STYLE} className="text-danger">
              <i className="bi bi-exclamation-triangle me-1"></i>
              周报数据加载失败：{weeklyQuery.error.message}
            </div>
          ) : weeklyQuery.isLoading ? (
            <div style={{ ...PANEL_STYLE, textAlign: 'center', padding: '56px 20px', color: '#A7B0B8' }}>
              <i className="bi bi-hourglass-split d-block mb-2" style={{ fontSize: 26 }}></i>
              加载中…
            </div>
          ) : rows.length === 0 ? (
            <div style={{ ...PANEL_STYLE, textAlign: 'center', padding: '56px 20px', color: '#A7B0B8' }}>
              <i className="bi bi-inbox d-block mb-2" style={{ fontSize: 26 }}></i>
              暂无周报数据
            </div>
          ) : (
            <div className="row g-3">
              {rows.slice(0, MAX_WEEKS).map((row, i) => (
                <div className="col-12 col-xl-6" key={row.weekKey}>
                  <WeekCard
                    row={row}
                    prev={rows[i + 1] || null}
                    stat={statMap[row.weekKey] || null}
                    statPrev={statMap[rows[i + 1]?.weekKey] || null}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'monthly' && <PendingTab label="月报" table="dws_periodic_report_overview_monthly" />}
      {tab === 'yearly' && <PendingTab label="年报" table="dws_periodic_report_overview_yearly" />}
    </div>
  );
}
