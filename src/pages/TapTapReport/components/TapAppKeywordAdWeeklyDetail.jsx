import { useState } from 'react';
import Sparkline from '../../../components/common/Sparkline';
import SparkStackBar from '../../../components/common/SparkStackBar';
import { useSqlQuery } from '../queries';
import { buildTapAppKeywordAdWeeklyDetailSql } from '../sql';
import { transformTapAppKeywordAdWeeklyDetail } from '../transforms';
import { GameIcon, truncateName, APP_AD_TAG_COLORS } from '../shared';

/** 弹框宽度（视口不够时自动收窄） */
const BOX_WIDTH = 760;
/** 每张表的每页行数 */
const PAGE_SIZE = 3;

/** 三个渠道：从上到下 搜索发现 / 热搜 / 热点 */
const CHANNELS = [
  { key: 'discover', label: '搜索发现广告', color: '#4361ee' },
  { key: 'hotSearch', label: '热搜广告', color: '#8B6FAD' },
  { key: 'hotSpot', label: '热点广告', color: '#B08B8B' },
];

/** 堆叠条两段：Android / iOS 广告投放次数 */
const SEGMENTS = [
  { key: 'android', label: 'Android广告', color: '#0f9d58' },
  { key: 'ios', label: 'iOS广告', color: '#7A8B99' },
];

/** 标签单元格 */
function TagCell({ tags }) {
  if (!tags || tags.length === 0) return <span className="text-muted">-</span>;
  return (
    <div className="d-flex flex-wrap" style={{ gap: 3 }}>
      {tags.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="badge"
          style={{ backgroundColor: APP_AD_TAG_COLORS[`tag${i + 1}`], color: '#fff', fontSize: 10, fontWeight: 500 }}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

/**
 * 一个渠道的明细表（自带翻页，每页 3 行）
 * 列：游戏名称+ICON / 标签 / 广告投放次数（Android+iOS 堆叠）/ 广告投放趋势
 */
function ChannelTable({ label, color, rows, labels, loading }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="mb-2">
      <div className="d-flex align-items-center justify-content-between mb-1">
        <span className="fw-semibold" style={{ fontSize: 12 }}>{label}</span>
        <span className="text-muted" style={{ fontSize: 11 }}>{loading ? '…' : `${rows.length} 个`}</span>
      </div>
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
          {pagedRows.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-muted" style={{ fontSize: 11 }}>
                {loading ? '加载中…' : '本周无数据'}
              </td>
            </tr>
          ) : (
            pagedRows.map((r) => {
              const name = r.appName || `APPID ${r.appId}`;
              return (
                <tr key={`${label}-${r.appId}`}>
                  <td>
                    <span className="d-inline-flex align-items-center gap-2">
                      <GameIcon src={r.icon} size={18} alt={r.appName ? `${r.appName} 图标` : ''} />
                      <span title={name} style={{ whiteSpace: 'nowrap' }}>{truncateName(name)}</span>
                    </span>
                  </td>
                  <td><TagCell tags={r.tags} /></td>
                  <td>
                    <SparkStackBar segments={SEGMENTS.map((seg) => ({ label: seg.label, value: r[seg.key], color: seg.color }))} />
                  </td>
                  <td>
                    <Sparkline data={r.trend} labels={labels} width={140} height={26} color={color} />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-1">
          <span className="text-muted" style={{ fontSize: 11 }}>共 {rows.length} 个，每页 {PAGE_SIZE} 个</span>
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
  );
}

/**
 * 「TapApp搜索关键词广告」提示标签：悬停弹出三张表（搜索发现 / 热搜 / 热点）。
 * 数据源 dws_taptap_ad_keywords_app_v4_daily，本周一至今逐日聚合；首次悬停才拉数据。
 */
export default function TapAppKeywordAdWeeklyDetail() {
  const [pos, setPos] = useState(null);
  const [opened, setOpened] = useState(false);
  const { data, isLoading, error } = useSqlQuery(
    'taptap-app-keyword-ad-weekly-detail',
    buildTapAppKeywordAdWeeklyDetailSql,
    [],
    (rows) => transformTapAppKeywordAdWeeklyDetail(rows), // useSqlQuery 第二个参数是总行数，limit 用默认值
    { enabled: opened, staleTime: 5 * 60 * 1000 },
  );

  const handleEnter = (e) => {
    setOpened(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const boxWidth = Math.min(BOX_WIDTH, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - boxWidth - 12));
    // 三张表较高：下方空间不够时向上展开，并限制最大高度保证整框落在视口内
    const spaceBelow = window.innerHeight - rect.bottom - 16;
    const spaceAbove = rect.top - 16;
    const openAbove = spaceBelow < 420 && spaceAbove > spaceBelow;
    setPos(
      openAbove
        ? { left, bottom: window.innerHeight - rect.top + 6, width: boxWidth, maxHeight: Math.max(260, spaceAbove) }
        : { left, top: rect.bottom + 6, width: boxWidth, maxHeight: Math.max(260, spaceBelow) },
    );
  };

  const labels = data?.labels || [];

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
        <span>TapApp搜索关键词广告</span>
      </span>

      {pos && (
        <div
          style={{
            position: 'fixed',
            left: pos.left,
            ...(pos.bottom != null ? { bottom: pos.bottom } : { top: pos.top }),
            width: pos.width,
            maxHeight: pos.maxHeight,
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
            <span className="fw-semibold" style={{ fontSize: 12 }}>TapApp搜索关键词广告</span>
            <span className="text-muted" style={{ fontSize: 11 }}>
              dws_taptap_ad_keywords_app_v4_daily · 本周一至今 · Top 15
            </span>
          </div>
          <div className="text-muted mb-2" style={{ fontSize: 11 }}>
            广告投放次数 = Android + iOS；三个渠道分别按各自 ad_views &gt; 0 筛选；趋势按周一→周日逐日
          </div>
          {error ? (
            <div className="text-danger" style={{ fontSize: 12 }}>
              <i className="bi bi-exclamation-triangle me-1"></i>
              {error.message}
            </div>
          ) : (
            CHANNELS.map((c) => (
              <ChannelTable
                key={c.key}
                label={c.label}
                color={c.color}
                rows={data?.[c.key] || []}
                labels={labels}
                loading={isLoading}
              />
            ))
          )}
        </div>
      )}
    </span>
  );
}
