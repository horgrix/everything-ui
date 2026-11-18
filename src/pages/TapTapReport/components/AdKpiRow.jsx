import { formatNumber } from '../../../utils/formatters';

/**
 * 广告统计 KPI 行：今日各渠道广告曝光次数（APP首页 / APP搜索页 / PC首页 / PC搜索页）
 *
 * 今日 = SQLite `dws_taptap_ad_aggr_v6_daily` 当日累计；
 * 昨日 / 上周同日 = MySQL v09（历史数据）同表。
 * 渠道口径：`app_*` = APP首页、`kw_*` = APP搜索页（关键词）、`pc_*` = PC首页；
 * 商业广告（ad_views）+ 资源互换（pcebid_views）合计为该渠道曝光。
 * PC 搜索页暂无数据源（未上线），固定为 0。
 */

const KPI_DEFS = [
  { key: 'appHome', label: '今日APP首页曝光', icon: 'bi-phone', accent: '#3E6E9E', tint: '#EAF1F6' },
  { key: 'appSearch', label: '今日APP搜索页曝光', icon: 'bi-search', accent: '#7D8F7B', tint: '#EEF3EE' },
  { key: 'pcHome', label: '今日PC首页曝光', icon: 'bi-pc-display', accent: '#8A6A33', tint: '#FBF2E7' },
  {
    key: 'pcSearch',
    label: '今日PC搜索页曝光',
    icon: 'bi-hourglass-split',
    accent: '#98A2AC',
    tint: '#F4F6F8',
    pending: true,
  },
];

const fmt = (v) => (v == null ? '—' : formatNumber(v));

function CompareRow({ label, base }) {
  return (
    <div className="d-flex align-items-center justify-content-between" style={{ fontSize: 11.5 }}>
      <span className="text-muted">{label}</span>
      <span style={{ color: '#5C6873', fontVariantNumeric: 'tabular-nums' }}>{fmt(base)}</span>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {{appHome:number,appSearch:number,pcHome:number,pcSearch:number}|null} props.today 今日曝光
 * @param {{yesterday:Object|null,lastWeek:Object|null}} props.history 昨日 / 上周同日曝光
 * @param {boolean} [props.loading]
 */
export default function AdKpiRow({ today, history, loading = false }) {
  return (
    <div className="mb-4">
      <div className="d-flex flex-wrap align-items-baseline justify-content-between gap-2 mb-2">
        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#232B33' }}>今日广告曝光概览</div>
        <span className="text-muted small">
          今日为当日累计（尚未满一天），只列对照值不出环比 · 昨日 / 上周同日取 MySQL 日表 · 商业广告 + 资源互换
        </span>
      </div>

      <div className="row g-3">
        {KPI_DEFS.map((def) => {
          const value = def.pending ? 0 : today?.[def.key] ?? null;
          const yBase = def.pending ? 0 : history?.yesterday?.[def.key] ?? null;
          const wBase = def.pending ? 0 : history?.lastWeek?.[def.key] ?? null;
          return (
            <div className="col-6 col-md-3" key={def.key}>
              <div
                className="card border-0 shadow-sm h-100"
                style={{ background: def.tint, border: `1px solid ${def.accent}1f` }}
              >
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
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#333D45', lineHeight: 1.35 }}>
                      {def.label}
                    </span>
                  </div>

                  <div className="d-flex align-items-baseline mt-2" style={{ gap: 6 }}>
                    <span
                      style={{
                        fontSize: 24,
                        fontWeight: 650,
                        letterSpacing: -0.6,
                        lineHeight: 1.1,
                        color: loading ? '#B7C0C8' : def.pending ? '#98A2AC' : '#1B2228',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {loading ? '—' : fmt(value)}
                    </span>
                    {def.pending && (
                      <span
                        className="badge rounded-pill fw-normal"
                        style={{ background: '#EDEFF2', color: '#7A8B99', fontSize: 10, padding: '1px 6px' }}
                      >
                        未上线
                      </span>
                    )}
                  </div>

                  <div className="mt-2 pt-2" style={{ borderTop: '1px dashed #E7EBEF' }}>
                    <CompareRow label="昨日" base={yBase} />
                    <div style={{ height: 4 }} />
                    <CompareRow label="上周" base={wBase} />
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
