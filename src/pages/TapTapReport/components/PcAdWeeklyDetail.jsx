import { useState } from 'react';
import Sparkline from '../../../components/common/Sparkline';
import { useSqlQuery } from '../queries';
import { buildPcAdWeeklyDetailSql } from '../sql';
import { transformPcAdWeeklyDetail } from '../transforms';
import { GameIcon, truncateName, APP_AD_TAG_COLORS } from '../shared';

/** 弹框宽度（视口不够时自动收窄） */
const BOX_WIDTH = 700;

/** 两张明细表的配置：标题 + 数据键 + 条形颜色 */
const TABLES = [
  { key: 'top', label: 'Top橱窗广告', color: '#4361ee' },
  { key: 'discovery', label: '每日新发现广告', color: '#8B6FAD' },
];

/** 一张明细表：游戏名称+ICON / 广告投放次数 / 广告投放趋势 */
function DetailTable({ label, color, rows, labels, loading }) {
  return (
    <div className="mb-2">
      <div className="d-flex align-items-center justify-content-between mb-1">
        <span className="fw-semibold" style={{ fontSize: 12 }}>{label}</span>
        <span className="text-muted" style={{ fontSize: 11 }}>{loading ? '…' : `${rows.length} 个`}</span>
      </div>
      <table className="table table-sm align-middle mb-0" style={{ fontSize: 12 }}>
        <thead>
          <tr className="text-muted">
            <th style={{ fontWeight: 500, width: '25%' }}>游戏名称</th>
            <th style={{ fontWeight: 500, width: '25%' }}>标签</th>
            <th style={{ fontWeight: 500, textAlign: 'end', width: '14%' }}>广告投放次数</th>
            <th style={{ fontWeight: 500, width: '36%' }}>广告投放趋势（本周）</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-muted" style={{ fontSize: 11 }}>{loading ? '加载中…' : '本周无数据'}</td>
            </tr>
          ) : (
            rows.map((r) => {
              const name = r.appName || `APPID ${r.appId}`;
              return (
                <tr key={`${label}-${r.appId}`}>
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
                  <td style={{ textAlign: 'end', fontWeight: 600 }}>{r.count}</td>
                  <td>
                    <Sparkline data={r.trend} labels={labels} width={140} height={26} color={color} />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 「TapPC广告本周明细」提示标签：悬停弹出上（Top橱窗广告）下（每日新发现广告）两张表。
 * 数据源 dws_taptap_pc_ad_landing_daily，本周一至今逐日聚合。
 * 弹框 fixed 定位避免被卡片裁剪；数据在第一次悬停时才拉取，不拖慢页面首屏。
 */
export default function PcAdWeeklyDetail() {
  const [pos, setPos] = useState(null);
  const [opened, setOpened] = useState(false);
  const { data, isLoading, error } = useSqlQuery(
    'taptap-pc-ad-weekly-detail',
    buildPcAdWeeklyDetailSql,
    [],
    (rows) => transformPcAdWeeklyDetail(rows), // useSqlQuery 第二个参数是总行数，这里只传 rows，limit 用默认值
    { enabled: opened, staleTime: 5 * 60 * 1000 },
  );

  const handleEnter = (e) => {
    setOpened(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const boxWidth = Math.min(BOX_WIDTH, window.innerWidth - 24);
    // 左边缘对齐标签左边缘，并夹在视口内
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - boxWidth - 12));
    setPos({ left, top: rect.bottom + 6, width: boxWidth });
  };

  const tables = data || { labels: [], top: [], discovery: [] };

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
        <span>TapPC广告本周明细</span>
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
            <span className="fw-semibold" style={{ fontSize: 12 }}>TapPC广告本周明细</span>
            <span className="text-muted" style={{ fontSize: 11 }}>
              dws_taptap_pc_ad_landing_daily · 本周一至今
            </span>
          </div>
          <div className="text-muted mb-2" style={{ fontSize: 11 }}>
            广告投放次数 = top_ad_views / discovery_ad_views（&gt; 0 才计入）；每张表按投放次数倒序取 Top 5；趋势按周一→周日逐日
          </div>
          {error ? (
            <div className="text-danger" style={{ fontSize: 12 }}>
              <i className="bi bi-exclamation-triangle me-1"></i>
              {error.message}
            </div>
          ) : (
            TABLES.map((t) => (
              <DetailTable
                key={t.key}
                label={t.label}
                color={t.color}
                rows={tables[t.key] || []}
                labels={tables.labels || []}
                loading={isLoading}
              />
            ))
          )}
        </div>
      )}
    </span>
  );
}
