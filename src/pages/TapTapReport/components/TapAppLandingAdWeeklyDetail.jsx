import { useState } from 'react';
import Sparkline from '../../../components/common/Sparkline';
import SparkStackBar from '../../../components/common/SparkStackBar';
import { useSqlQuery } from '../queries';
import { buildTapAppLandingAdWeeklyDetailSql } from '../sql';
import { transformTapAppLandingAdWeeklyDetail } from '../transforms';
import { GameIcon, truncateName, APP_AD_TAG_COLORS } from '../shared';

/** 弹框宽度（视口不够时自动收窄） */
const BOX_WIDTH = 720;
/** 每页行数 */
const PAGE_SIZE = 5;

/** 堆叠条三段：Android 广告 / iOS 广告 / 资源互换(pcebid) */
const SEGMENTS = [
  { key: 'android', label: 'Android广告', color: '#0f9d58' },
  { key: 'ios', label: 'iOS广告', color: '#7A8B99' },
  { key: 'pcebid', label: '资源互换(pcebid)', color: '#B08B8B' },
];

/**
 * 「TapApp首页广告本周明细」提示标签：悬停弹出一张表
 * （游戏名称+ICON / 标签 / 广告投放次数（Android+iOS+pcebid 堆叠）/ 广告投放趋势）。
 * 数据源 dws_taptap_ad_landing_app_v4_daily，本周一至今逐日聚合；首次悬停才拉数据。
 */
export default function TapAppLandingAdWeeklyDetail() {
  const [pos, setPos] = useState(null);
  const [opened, setOpened] = useState(false);
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useSqlQuery(
    'taptap-app-landing-ad-weekly-detail',
    buildTapAppLandingAdWeeklyDetailSql,
    [],
    (rows) => transformTapAppLandingAdWeeklyDetail(rows), // useSqlQuery 第二个参数是总行数，这里只传 rows，limit 用默认值
    { enabled: opened, staleTime: 5 * 60 * 1000 },
  );

  const handleEnter = (e) => {
    setOpened(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const boxWidth = Math.min(BOX_WIDTH, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - boxWidth - 12));
    setPos({ left, top: rect.bottom + 6, width: boxWidth });
  };

  const rows = data?.rows || [];
  const labels = data?.labels || [];
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <span
      className="d-inline-flex align-items-center"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setPos(null)}
      style={{ position: 'relative' }}
    >
      <span
        className="badge border text-secondary d-inline-flex align-items-center gap-1"
        style={{ backgroundColor: '#f8f9fa', fontWeight: 500, cursor: 'help' }}
      >
        <i className="bi bi-info-circle" style={{ fontSize: 11 }}></i>
        <span>TapApp首页广告本周明细</span>
      </span>

      {pos && (
        <div
          style={{
            position: 'fixed',
            left: pos.left,
            top: pos.top,
            width: pos.width,
            maxHeight: '80vh',
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid #dee2e6',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: '10px 12px',
            zIndex: 2000,
            textAlign: 'left',
          }}
        >
          <div className="d-flex align-items-center justify-content-between mb-2">
            <span className="fw-semibold" style={{ fontSize: 12 }}>TapApp首页广告本周明细</span>
            <span className="text-muted" style={{ fontSize: 11 }}>
              dws_taptap_ad_landing_app_v4_daily · 本周一至今 · Top 10
            </span>
          </div>
          <div className="text-muted mb-2" style={{ fontSize: 11 }}>
            广告投放次数 = Android广告 + iOS广告 + 资源互换(pcebid)；筛选 pcebid_views + ad_views &gt; 0；趋势按周一→周日逐日
          </div>
          {error ? (
            <div className="text-danger" style={{ fontSize: 12 }}>
              <i className="bi bi-exclamation-triangle me-1"></i>
              {error.message}
            </div>
          ) : (
            <table className="table table-sm align-middle mb-0" style={{ fontSize: 12 }}>
              <thead>
                <tr className="text-muted">
                  <th style={{ fontWeight: 500, width: '24%' }}>游戏名称</th>
                  <th style={{ fontWeight: 500, width: '22%' }}>标签</th>
                  <th style={{ fontWeight: 500, width: '22%' }}>广告投放次数</th>
                  <th style={{ fontWeight: 500, width: '32%' }}>广告投放趋势（本周）</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-muted" style={{ fontSize: 11 }}>
                      {isLoading ? '加载中…' : '本周无数据'}
                    </td>
                  </tr>
                ) : (
                  pagedRows.map((r) => {
                    const name = r.appName || `APPID ${r.appId}`;
                    return (
                      <tr key={r.appId}>
                        <td>
                          <span className="d-inline-flex align-items-center gap-2">
                            <GameIcon src={r.icon} size={18} alt={r.appName ? `${r.appName} 图标` : ''} />
                            <span title={name} style={{ whiteSpace: 'nowrap' }}>{truncateName(name)}</span>
                          </span>
                        </td>
                        <td>
                          <div className="d-flex flex-wrap" style={{ gap: 3 }}>
                            {(r.tags || []).length === 0 && <span className="text-muted">-</span>}
                            {(r.tags || []).map((tag, i) => (
                              <span
                                key={`${tag}-${i}`}
                                className="badge"
                                style={{ backgroundColor: APP_AD_TAG_COLORS[`tag${i + 1}`], color: '#fff', fontSize: 10, fontWeight: 500 }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <SparkStackBar
                            segments={SEGMENTS.map((seg) => ({ label: seg.label, value: r[seg.key], color: seg.color }))}
                          />
                        </td>
                        <td>
                          <Sparkline data={r.trend} labels={labels} width={140} height={26} color="#4361ee" />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
          {!error && totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-2">
              <span className="text-muted" style={{ fontSize: 11 }}>
                共 {rows.length} 个，每页 {PAGE_SIZE} 个
              </span>
              <nav>
                <ul className="pagination pagination-sm mb-0">
                  <li className={`page-item ${currentPage <= 1 ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => setPage(Math.max(1, currentPage - 1))}>上一页</button>
                  </li>
                  <li className="page-item disabled"><span className="page-link">{currentPage} / {totalPages}</span></li>
                  <li className={`page-item ${currentPage >= totalPages ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => setPage(Math.min(totalPages, currentPage + 1))}>下一页</button>
                  </li>
                </ul>
              </nav>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
