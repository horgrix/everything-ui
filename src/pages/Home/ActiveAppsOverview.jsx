import { useQuery } from '@tanstack/react-query';
import { fetchActiveApps, currentMonthKey } from '../../api/home';
import Sparkline from '../../components/common/Sparkline';

/**
 * 本月采集活跃 APP 数（4 个模块）—— 首页顶部概览。
 *
 * 数据来自 everything-api 的 `GET /api/v09/home/active-apps?month=YYYY-MM`
 * （后端读 MySQL `dws_taptap_active_game_stat`：monthly 快照 + daily 明细），前端不再直连数据库。
 * 字段：ad_app_cnt（有广告）/ download_app_cnt（有下载）/ online_players_app_cnt（有在线）/ reserve_app_cnt（有预约）
 */

/** 四个指标的口径、配色与图标 */
const METRICS = [
  {
    key: 'download_app_cnt',
    label: '有下载 APP',
    desc: '本月采集到下载量的游戏',
    icon: 'bi-cloud-arrow-down',
    tint: '#EAF1F6',
    accent: '#3E6E9E',
  },
  {
    key: 'online_players_app_cnt',
    label: '有在线 APP',
    desc: '本月采集到在线人数的游戏',
    icon: 'bi-people',
    tint: '#EAF3EE',
    accent: '#3F7A5E',
  },
  {
    key: 'ad_app_cnt',
    label: '有广告 APP',
    desc: '本月采集到广告投放的游戏',
    icon: 'bi-megaphone',
    tint: '#F6EFEC',
    accent: '#8A5A45',
  },
  {
    key: 'reserve_app_cnt',
    label: '有预约 APP',
    desc: '本月采集到预约数据的游戏',
    icon: 'bi-bookmark-star',
    tint: '#F3EFF8',
    accent: '#5F4B86',
  },
];

export default function ActiveAppsOverview() {
  const month = currentMonthKey();

  const statQuery = useQuery({
    queryKey: ['home-active-apps', month],
    queryFn: () => fetchActiveApps(month),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { monthly, daily = [], latest_day: latestDay } = statQuery.data || {};
  const loading = statQuery.isLoading;

  const num = (v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));
  const fmt = (v) => (v == null ? '—' : Number(v).toLocaleString('zh-CN'));

  /** 某个指标：本月累计 / 本月日均 / 最新一天 / 每日曲线 */
  const pick = (key) => {
    const series = daily.map((r) => num(r[key]));
    const valid = series.filter((v) => v != null);
    const avg = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
    return {
      total: monthly ? num(monthly[key]) : null,
      avg,
      latest: valid.length ? valid[valid.length - 1] : null,
      series,
      labels: daily.map((r) => String(r.date).slice(5)),
    };
  };

  return (
    <div className="mb-4">
      {/* 区块标题 */}
      <div className="d-flex flex-wrap align-items-baseline justify-content-between gap-2 mb-3">
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#232B33' }}>
            本月采集活跃 APP
            {statQuery.error && (
              <span className="ms-2" style={{ fontSize: 11.5, color: '#C0504D', fontWeight: 400 }}>
                数据读取失败：{statQuery.error.message}
              </span>
            )}
          </div>
          <div className="text-muted small mt-1">
            {month} 月度快照 · 累计去重的活跃 APP 数（有该行为才算活跃）
            {latestDay && <span className="ms-2">· 明细截至 {latestDay}</span>}
          </div>
        </div>
        <span
          className="badge rounded-pill fw-normal d-inline-flex align-items-center"
          title="数据源 dws_taptap_active_game_stat，每日更新"
          style={{
            background: '#EDEFF2',
            color: '#7A8B99',
            fontSize: 11,
            padding: '3px 10px',
            border: '1px solid #E3E7EB',
          }}
        >
          <i className="bi bi-clock-history me-1" />
          每日更新
        </span>
      </div>

      {/* 4 个指标卡 */}
      <div className="row g-3">
        {METRICS.map((m) => {
          const d = pick(m.key);
          const noData = d.total == null && d.latest == null;
          return (
            <div className="col-12 col-sm-6 col-xl-3" key={m.key}>
              <div
                className="card border-0 shadow-sm h-100 stat-card"
                style={{ background: m.tint, border: `1px solid ${m.accent}1f` }}
              >
                <div className="card-body d-flex flex-column" style={{ padding: '18px 20px 16px' }}>
                  {/* 图标 + 日均 */}
                  <div className="d-flex align-items-start justify-content-between">
                    <span
                      className="d-inline-flex align-items-center justify-content-center"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        background: '#fff',
                        color: m.accent,
                        fontSize: 15,
                        boxShadow: '0 1px 2px rgba(16,24,40,0.06)',
                      }}
                    >
                      <i className={`bi ${m.icon}`} />
                    </span>
                    <span className="text-muted" style={{ fontSize: 11.5 }}>
                      日均 {fmt(d.avg == null ? null : Math.round(d.avg))}
                    </span>
                  </div>

                  {/* 主数值 */}
                  <div className="d-flex align-items-baseline mt-3" style={{ gap: 6 }}>
                    <span
                      style={{
                        fontSize: 34,
                        fontWeight: 650,
                        letterSpacing: -1,
                        lineHeight: 1.05,
                        color: loading ? '#B7C0C8' : '#1B2228',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {loading ? '—' : fmt(d.total)}
                    </span>
                    <span style={{ fontSize: 12.5, color: '#7A8B99' }}>个 APP</span>
                  </div>

                  {/* 指标名 + 口径 */}
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#333D45', marginTop: 6 }}>{m.label}</div>
                  <div className="text-muted" style={{ fontSize: 11.5, marginTop: 3, lineHeight: 1.5 }}>
                    {statQuery.error
                      ? '数据接口暂不可用'
                      : noData && !loading
                        ? '本月暂无该行为的采集数据'
                        : m.desc}
                  </div>

                  {/* 每日曲线 */}
                  <div className="mt-auto pt-3 d-flex align-items-end justify-content-between" style={{ gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <Sparkline
                        data={d.series}
                        labels={d.labels}
                        width={198}
                        height={34}
                        color={m.accent}
                        currentLabel={m.label}
                      />
                    </div>
                    <div className="text-end" style={{ fontSize: 11.5, color: '#7A8B99', whiteSpace: 'nowrap' }}>
                      最新 {fmt(d.latest)}
                    </div>
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
