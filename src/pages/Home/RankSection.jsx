import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GAME_TYPE_META } from '../TapTapReport/constants';

/**
 * 榜单区块（通用）：三个榜并排 —— top 总量 / gain 增量最多 / loss 下滑最多。
 *
 * 数据来自 everything-api 的 `/api/v09/data/home/{download-rank|ad-rank}`，
 * 后端返回 items：{ rank_no, app_id, app_name, icon, distribution_type, tags, total, prev, diff }；
 * 各榜数值口径不同（下载量 / 广告曝光次数），格式化由调用方传入的 format 决定。
 */

/** 增量带符号显示 */
function formatDelta(v, format) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  if (n === 0) return '0';
  return `${n > 0 ? '+' : '−'}${format(Math.abs(n))}`;
}

/**
 * @param {Object} props
 * @param {string} props.title        区块标题，如「本月下载榜」
 * @param {string} props.subtitle     区块副标题（口径说明）
 * @param {{text: string, title: string}} props.badge 右侧标签
 * @param {Record<string, Object>} props.categoryMeta 三个榜的标题 / 说明 / 配色
 * @param {string} props.queryKey     react-query key 前缀
 * @param {(month: string, limit: number) => Promise<any>} props.fetcher 取数函数
 * @param {(v: number|null) => string} props.format 数值格式化
 * @param {string} props.month        统计月份 YYYY-MM
 * @param {number} [props.limit]      每榜条数，默认 5
 */
export default function RankSection({
  title,
  subtitle,
  badge,
  categoryMeta,
  queryKey,
  fetcher,
  format,
  month,
  limit = 5,
}) {
  const rankQuery = useQuery({
    queryKey: [queryKey, month, limit],
    queryFn: () => fetcher(month, limit),
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
            {title} Top{limit}
            {rankQuery.error && (
              <span className="ms-2" style={{ fontSize: 11.5, color: '#C0504D', fontWeight: 400 }}>
                数据读取失败：{rankQuery.error.message}
              </span>
            )}
          </div>
          <div className="text-muted small mt-1">{subtitle}</div>
        </div>
        <span
          className="badge rounded-pill fw-normal d-inline-flex align-items-center"
          title={badge.title}
          style={{
            background: '#EDEFF2',
            color: '#7A8B99',
            fontSize: 11,
            padding: '3px 10px',
            border: '1px solid #E3E7EB',
          }}
        >
          <i className="bi bi-clock-history me-1" />
          {badge.text}
        </span>
      </div>

      <div className="row g-3">
        {Object.entries(categoryMeta).map(([key, meta]) => {
          const block = categories.find((c) => c.key === key);
          const items = block?.items || [];
          return (
            <div className="col-12 col-xl-4" key={key}>
              <div className="card border-0 shadow-sm h-100" style={{ border: `1px solid ${meta.accent}1f` }}>
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

                {/* TopN 列表 */}
                <div className="card-body" style={{ padding: '4px 18px 14px' }}>
                  {loading &&
                    Array.from({ length: limit }).map((_, i) => (
                      <div
                        key={i}
                        className="d-flex align-items-center"
                        style={{ gap: 10, padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid #F6F8FA' }}
                      >
                        <span style={{ width: 20, height: 20, borderRadius: 6, background: '#F1F4F6' }} />
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
                      const diff = item.diff;
                      const diffColor = diff == null || diff === 0 ? '#98A2AC' : diff > 0 ? '#C0504D' : '#3F7A5E';
                      return (
                        <Link
                          key={`${key}-${item.rank_no}-${item.app_id}`}
                          to={`/one-search/report?q=${item.app_id}`}
                          className="d-flex align-items-center text-decoration-none rank-row"
                          title={
                            `${item.app_name || item.app_id}｜本月 ${format(item.total)}` +
                            (item.prev == null ? '' : `｜上期 ${format(item.prev)}`) +
                            (diff == null ? '' : `｜${formatDelta(diff, format)}`)
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
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 9,
                                objectFit: 'cover',
                                flexShrink: 0,
                                background: '#F4F6F8',
                              }}
                            />
                          ) : (
                            <span
                              className="flex-shrink-0"
                              style={{ width: 30, height: 30, borderRadius: 9, background: '#F4F6F8' }}
                            />
                          )}

                          {/* 名称 + 类型 / 标签 */}
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
                                  style={{
                                    fontSize: 10.5,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* 数值 */}
                          <div className="text-end flex-shrink-0">
                            <div
                              style={{
                                fontSize: 12.5,
                                fontWeight: 600,
                                color: '#232B33',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {format(item.total)}
                            </div>
                            <div
                              style={{
                                fontSize: 10.5,
                                color: diffColor,
                                fontVariantNumeric: 'tabular-nums',
                                marginTop: 1,
                              }}
                            >
                              {formatDelta(diff, format)}
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
