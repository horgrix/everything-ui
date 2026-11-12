import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTypeShare, currentMonthKey } from '../../api/home';

/**
 * 本月游戏类型占比（商业 / 独立 / Maker）—— 首页概览。
 *
 * 数据来自 everything-api 的 `GET /api/v09/home/type-share?month=YYYY-MM`：
 * 后端读三张 MySQL 月表（download / pc_online_peak_players / ad_aggr_v6 的 periodic_report）
 * 按 category_type='dist' 聚合后返回 types / totals / unclassified，前端只做展示。
 * dist：0 商业 / 1 独立 / 2 Maker。
 */

/** 三类游戏：文案 + 配色（取自全局色库 AD_MATERIAL_COLORS） */
const TYPES = [
  { key: '0', label: '商业游戏', color: '#5C6B7A' },
  { key: '1', label: '独立小游戏', color: '#7D8F7B' },
  { key: '2', label: 'Maker小游戏', color: '#B4AEC0' },
];

/** 三个指标：字段名 + 文案 */
const METRICS = [
  { key: 'download', label: '下载量' },
  { key: 'online', label: '在线峰值' },
  { key: 'ad', label: '广告曝光' },
];

/** 数值格式化：≥1 亿用亿，≥1 万用万，其余千分位 */
function fmtNum(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
  return n.toLocaleString('zh-CN');
}

const fmtPct = (v) => `${v.toFixed(1)}%`;

export default function TypeShareOverview() {
  const month = currentMonthKey();

  const shareQuery = useQuery({
    queryKey: ['home-type-share', month],
    queryFn: () => fetchTypeShare(month),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // 接口返回 types[] / totals / unclassified，这里摊平成 { byType, games, uncategorizedAd }
  const { byType, games, uncategorizedAd } = useMemo(() => {
    const nextByType = {};
    const nextGames = {};
    TYPES.forEach((t) => {
      nextByType[t.key] = { download: 0, online: 0, ad: 0 };
      nextGames[t.key] = null;
    });
    (shareQuery.data?.types || []).forEach((item) => {
      const key = String(item.dist ?? '').trim();
      if (!nextByType[key]) return;
      nextByType[key] = {
        download: Number(item.download_total) || 0,
        online: Number(item.peak_online_players) || 0,
        ad: Number(item.ad_views) || 0,
      };
      nextGames[key] = item.game_cnt == null ? 0 : Number(item.game_cnt);
    });
    return {
      byType: nextByType,
      games: nextGames,
      uncategorizedAd: Number(shareQuery.data?.unclassified?.ad_views) || 0,
    };
  }, [shareQuery.data]);
  const loading = shareQuery.isLoading;
  const valueOf = (key, metric) => Number(byType[key]?.[metric] || 0);

  /** 某指标三类合计（占比分母） */
  const totalOf = (metric) => TYPES.reduce((sum, t) => sum + valueOf(t.key, metric), 0);

  /** 某类型在某指标里的占比数值（0~100） */
  const pctOf = (key, metric) => {
    const total = totalOf(metric);
    return total > 0 ? (valueOf(key, metric) / total) * 100 : 0;
  };

  return (
    <div className="mb-4">
      {/* 区块标题 */}
      <div className="d-flex flex-wrap align-items-baseline justify-content-between gap-2 mb-3">
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#232B33' }}>
            本月游戏类型占比
            {shareQuery.error && (
              <span className="ms-2" style={{ fontSize: 11.5, color: '#C0504D', fontWeight: 400 }}>
                数据读取失败：{shareQuery.error.message}
              </span>
            )}
          </div>
          <div className="text-muted small mt-1">
            {month} 月度快照 · 商业游戏 / 独立小游戏 / Maker小游戏 三类的下载量 · 在线峰值 · 广告曝光占比
          </div>
        </div>
        {/* 图例 */}
        <div className="d-flex align-items-center gap-3">
          {TYPES.map((t) => (
            <span key={t.key} className="d-inline-flex align-items-center" style={{ fontSize: 11.5, color: '#7A8B99' }}>
              <span
                style={{ width: 8, height: 8, borderRadius: 3, background: t.color, marginRight: 5, display: 'inline-block' }}
              />
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {/* 占比横条（100% 堆叠） */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body" style={{ padding: '18px 20px' }}>
          {METRICS.map((m, idx) => {
            const total = totalOf(m.key);
            return (
              <div key={m.key} className={idx === 0 ? '' : 'mt-3'}>
                <div className="d-flex align-items-baseline justify-content-between mb-2">
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#333D45' }}>{m.label}</span>
                  <span style={{ fontSize: 11.5, color: '#98A2AC' }}>三类合计 {loading ? '—' : fmtNum(total)}</span>
                </div>
                <div className="d-flex" style={{ height: 30, borderRadius: 8, overflow: 'hidden', background: '#F4F6F8' }}>
                  {loading && <div className="flex-grow-1" />}
                  {!loading &&
                    TYPES.map((t) => {
                      const v = valueOf(t.key, m.key);
                      const pct = pctOf(t.key, m.key);
                      if (pct <= 0) return null;
                      return (
                        <div
                          key={t.key}
                          title={`${t.label}：${fmtNum(v)}（${fmtPct(pct)}）`}
                          className="d-flex align-items-center justify-content-center"
                          style={{
                            width: `${pct}%`,
                            background: t.color,
                            borderRight: '2px solid #fff',
                            transition: 'width 0.4s ease',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {pct >= 9 && (
                            <span
                              style={{
                                color: '#fff',
                                fontSize: 11.5,
                                fontWeight: 600,
                                letterSpacing: 0.2,
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {fmtPct(pct)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
                {/* 占比不足 9% 的段落在条外补标签，避免字号塞不下 */}
                {!loading && total > 0 && (
                  <div className="d-flex flex-wrap gap-3 mt-2">
                    {TYPES.filter((t) => pctOf(t.key, m.key) < 9).map((t) => (
                      <span key={t.key} style={{ fontSize: 11, color: '#7A8B99' }}>
                        <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 2, background: t.color, marginRight: 5 }} />
                        {t.label} {fmtPct(pctOf(t.key, m.key))}
                        <span className="text-muted ms-1">（{fmtNum(valueOf(t.key, m.key))}）</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {!loading && uncategorizedAd > 0 && (
            <div className="text-muted mt-3" style={{ fontSize: 11, lineHeight: 1.6 }}>
              注：广告曝光另有 {fmtNum(uncategorizedAd)} 来自未分类游戏（dist 缺失），未计入占比；占比分母为三类合计。
            </div>
          )}
        </div>
      </div>

      {/* 三类明细卡 */}
      <div className="row g-3">
        {TYPES.map((t) => {
          const mainPct = pctOf(t.key, 'download');
          return (
            <div className="col-12 col-md-4" key={t.key}>
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body" style={{ padding: '16px 20px 18px' }}>
                  {/* 类型名 + 该类型下载量占比 */}
                  <div className="d-flex align-items-center justify-content-between">
                    <span className="d-inline-flex align-items-center" style={{ fontSize: 13, fontWeight: 600, color: '#232B33' }}>
                      <span style={{ width: 3, height: 13, borderRadius: 2, background: t.color, marginRight: 8, display: 'inline-block' }} />
                      {t.label}
                    </span>
                    <span style={{ fontSize: 11.5, color: '#98A2AC' }}>
                      在采 {loading ? '—' : fmtNum(games[t.key] ?? 0)} 款
                    </span>
                  </div>

                  {/* 下载量占比：主数值 */}
                  <div className="d-flex align-items-baseline mt-3" style={{ gap: 6 }}>
                    <span
                      style={{
                        fontSize: 30,
                        fontWeight: 650,
                        letterSpacing: -0.8,
                        lineHeight: 1.05,
                        color: t.color,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {loading ? '—' : fmtPct(mainPct)}
                    </span>
                    <span style={{ fontSize: 11.5, color: '#7A8B99' }}>下载量占比</span>
                  </div>

                  {/* 三指标明细 */}
                  <div className="mt-3">
                    {METRICS.map((m, i) => (
                      <div
                        key={m.key}
                        className="d-flex align-items-center justify-content-between"
                        style={{
                          paddingTop: i === 0 ? 0 : 7,
                          marginTop: i === 0 ? 0 : 0,
                          borderTop: i === 0 ? 'none' : '1px dashed #F0F3F5',
                          paddingBottom: 0,
                        }}
                      >
                        <span style={{ fontSize: 11.5, color: '#98A2AC', paddingTop: i === 0 ? 0 : 7 }}>{m.label}</span>
                        <span className="d-flex align-items-baseline" style={{ gap: 8, paddingTop: i === 0 ? 0 : 7 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#333D45', fontVariantNumeric: 'tabular-nums' }}>
                            {loading ? '—' : fmtNum(valueOf(t.key, m.key))}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: t.color,
                              fontWeight: 600,
                              minWidth: 44,
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {loading ? '' : fmtPct(pctOf(t.key, m.key))}
                          </span>
                        </span>
                      </div>
                    ))}
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
