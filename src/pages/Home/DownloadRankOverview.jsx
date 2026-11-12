import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchDownloadRank, currentMonthKey } from '../../api/home';
import { GAME_TYPE_META } from '../TapTapReport/constants';

/**
 * 本月下载榜 Top5（三个榜并排）—— 首页概览。
 *
 * 数据来自 everything-api 的 `GET /api/v09/home/download-rank?month=YYYY-MM&limit=5`
 * （后端读 MySQL `dws_taptap_download_periodic_rank`，period_type='monthly'）。
 * 三个榜：top 下载总量 / gain 增量最多 / loss 下滑最多。
 */

/** 三个榜的展示文案与配色 */
const CATEGORY_META = {
  top: {
    title: '下载总量 Top5',
    desc: '本月累计下载量排名',
    icon: 'bi-trophy',
    accent: '#5C6B7A',
    tint: '#EDF1F5',
  },
  gain: {
    title: '新增最多 Top5',
    desc: '较上期增量排名',
    icon: 'bi-graph-up-arrow',
    accent: '#7D8F7B',
    tint: '#EEF3EE',
  },
  loss: {
    title: '下滑最多 Top5',
    desc: '较上期降幅排名',
    icon: 'bi-graph-down-arrow',
    accent: '#B08B8B',
    tint: '#F5EFEF',
  },
};

/** 数值格式化：≥1 亿用亿，≥1 万用万，其余千分位 */
function fmtNum(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
  return n.toLocaleString('zh-CN');
}

/** 增量带符号显示 */
function fmtDelta(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  if (n === 0) return '0';
  return `${n > 0 ? '+' : '−'}${fmtNum(Math.abs(n))}`;
}

export default function DownloadRankOverview() {
  const month = currentMonthKey();
  const LIMIT = 5;

  const rankQuery = useQuery({
    queryKey: ['home-download-rank', month, LIMIT],
    queryFn: () => fetchDownloadRank(month, LIMIT),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const categories = rankQuery.data?.categories || [];
  const loading = rankQuery.isLoading;

  return (
    <div className="mb-4">
      {/* 区块标题 */}
      <div className="d-flex flex-wrap align-items-baseline justify-content-between gap-2 mb-3">
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#232B33' }}>
            本月下载榜 Top{LIMIT}
            {rankQuery.error && (
              <span className="ms-2" style={{ fontSize: 11.5, color: '#C0504D', fontWeight: 400 }}>
                数据读取失败：{rankQuery.error.message}
              </span>
            )}
          </div>
          <div className="text-muted small mt-1">
            {month} 月度快照 · 下载总量 / 新增最多 / 下滑最多三个榜各取前 {LIMIT} 名
          </div>
        </div>
        <span
          className="badge rounded-pill fw-normal d-inline-flex align-items-center"
          title="数据源 dws_taptap_download_periodic_rank，每月更新"
          style={{
            background: '#EDEFF2',
            color: '#7A8B99',
            fontSize: 11,
            padding: '3px 10px',
            border: '1px solid #E3E7EB',
          }}
        >
          <i className="bi bi-clock-history me-1" />
          每月更新
        </span>
      </div>

      <div className="row g-3">
        {Object.entries(CATEGORY_META).map(([key, meta]) => {
          const block = categories.find((c) => c.key === key);
          const items = block?.items || [];
          return (
            <div className="col-12 col-xl-4" key={key}>
              <div
                className="card border-0 shadow-sm h-100"
                style={{ border: `1px solid ${meta.accent}1f` }}
              >
                {/* 榜头 */}
                <div
                  className="card-header bg-white border-0 d-flex align-items-center justify-content-between"
                  style={{ padding: '14px 18px' }}
                >
                  <div className="d-flex align-items-center" style={{ gap: 9 }}>
                    <span
                      className="d-inline-flex align-items-center justify-content-center"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 9,
                        background: meta.tint,
                        color: meta.accent,
                        fontSize: 13.5,
                      }}
                    >
                      <i className={`bi ${meta.icon}`} />
                    </span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#232B33' }}>{meta.title}</div>
                      <div className="text-muted" style={{ fontSize: 11, marginTop: 1 }}>{meta.desc}</div>
                    </div>
                  </div>
                </div>

                {/* Top5 列表 */}
                <div className="card-body" style={{ padding: '4px 18px 14px' }}>
                  {loading &&
                    Array.from({ length: LIMIT }).map((_, i) => (
                      <div
                        key={i}
                        className="d-flex align-items-center"
                        style={{ gap: 10, padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid #F6F8FA' }}
                      >
                        <span style={{ width: 18, height: 18, borderRadius: 6, background: '#F1F4F6' }} />
                        <span style={{ width: 30, height: 30, borderRadius: 9, background: '#F1F4F6' }} />
                        <span className="flex-grow-1" style={{ height: 12, borderRadius: 4, background: '#F1F4F6' }} />
                      </div>
                    ))}

                  {!loading && items.length === 0 && (
                    <div className="text-muted py-4 text-center" style={{ fontSize: 12 }}>
                      {rankQuery.error ? '数据接口暂不可用' : '本月暂无该榜数据'}
                    </div>
                  )}

                  {!loading &&
                    items.map((item, idx) => {
                      const typeMeta = GAME_TYPE_META[item.distribution_type];
                      const delta = item.diff_download;
                      const deltaColor = delta == null || delta === 0 ? '#98A2AC' : delta > 0 ? '#C0504D' : '#3F7A5E';
                      return (
                        <Link
                          key={`${key}-${item.rank_no}-${item.app_id}`}
                          to={`/one-search/report?q=${item.app_id}`}
                          className="d-flex align-items-center text-decoration-none rank-row"
                          title={
                            `${item.app_name || item.app_id}｜本月 ${fmtNum(item.total_download)}` +
                            (item.prev_total_download == null ? '' : `｜上期 ${fmtNum(item.prev_total_download)}`) +
                            (delta == null ? '' : `｜${fmtDelta(delta)}`)
                          }
                          style={{
                            gap: 10,
                            padding: '9px 0',
                            borderTop: idx === 0 ? 'none' : '1px solid #F6F8FA',
                          }}
                        >
                          {/* 名次 */}
                          <span
                            className="d-inline-flex align-items-center justify-content-center flex-shrink-0"
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 650,
                              fontVariantNumeric: 'tabular-nums',
                              background: idx < 3 ? meta.tint : '#F6F8FA',
                              color: idx < 3 ? meta.accent : '#98A2AC',
                            }}
                          >
                            {item.rank_no ?? idx + 1}
                          </span>

                          {/* 图标 */}
                          {item.icon ? (
                            <img
                              src={item.icon}
                              alt=""
                              loading="lazy"
                              style={{ width: 30, height: 30, borderRadius: 9, objectFit: 'cover', flexShrink: 0, background: '#F4F6F8' }}
                            />
                          ) : (
                            <span
                              className="flex-shrink-0"
                              style={{ width: 30, height: 30, borderRadius: 9, background: '#F4F6F8' }}
                            />
                          )}

                          {/* 名称 + 类型/标签 */}
                          <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                            <div
                              style={{
                                fontSize: 12.5,
                                fontWeight: 550,
                                color: '#232B33',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {item.app_name || `APPID ${item.app_id}`}
                            </div>
                            <div className="d-flex align-items-center" style={{ gap: 6, marginTop: 2 }}>
                              {typeMeta && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    lineHeight: 1.5,
                                    padding: '0 5px',
                                    borderRadius: 5,
                                    color: '#5C6873',
                                    background: '#F1F4F6',
                                  }}
                                >
                                  {typeMeta.label}
                                </span>
                              )}
                              {(item.tags || []).slice(0, 1).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-muted"
                                  style={{ fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* 数值 */}
                          <div className="text-end flex-shrink-0">
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#232B33', fontVariantNumeric: 'tabular-nums' }}>
                              {fmtNum(item.total_download)}
                            </div>
                            <div style={{ fontSize: 10.5, color: deltaColor, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
                              {fmtDelta(delta)}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
