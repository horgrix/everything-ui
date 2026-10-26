import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWeekStats } from '../../api/stats';
import { formatNumber } from '../../utils/formatters';

/** 路由 → 报表名，hover 面板里展示更直观（未命中的路径直接显示原始 path） */
const PATH_LABELS = {
  '/': '首页',
  '/business': 'Games报表',
  '/one-search': 'One Search',
  '/one-search/report': 'One Search 报告',
  '/taptap': 'TapTap报表',
  '/taprep-monthly': 'TapREP月报',
  '/finance': '财务信息',
  '/quant': '量化信息',
  '/reports': '定期报告',
};

const pathLabel = (path) => PATH_LABELS[path] || path || '-';

/**
 * 本周 PV / UV 小徽章（放在导航栏「数据可视化平台」右侧）
 * - 接口未就绪或失败时整体不渲染，不占位、不报错
 * - 数据 staleTime 5 分钟，不轮询；hover 才展开分报表 Top3
 */
export default function VisitStats() {
  const [pos, setPos] = useState(null);

  const { data } = useQuery({
    queryKey: ['visit-stats-week'],
    queryFn: fetchWeekStats,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: true,
  });

  // 接口未就绪 / 失败 / 本周还没数据 → 不渲染（避免首屏出现「PV 0 UV 0」）
  if (!data || (!data.pv && !data.uv)) return null;

  const { pv, uv, topPaths, weekStart, mock } = data;

  return (
    <>
      <span
        className="d-none d-xl-inline-flex align-items-center rounded-pill"
        style={{
          gap: 10,
          padding: '3px 10px',
          fontSize: 12,
          lineHeight: '18px',
          color: 'rgba(255,255,255,0.75)',
          backgroundColor: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          cursor: 'default',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setPos({ x: rect.left, y: rect.bottom + 8 });
        }}
        onMouseLeave={() => setPos(null)}
      >
        <span className="d-inline-flex align-items-center" style={{ gap: 4 }}>
          <i className="bi bi-eye" style={{ fontSize: 12 }}></i>
          PV <span className="fw-semibold text-white">{formatNumber(pv)}</span>
        </span>
        <span style={{ opacity: 0.35 }}>|</span>
        <span className="d-inline-flex align-items-center" style={{ gap: 4 }}>
          <i className="bi bi-person" style={{ fontSize: 12 }}></i>
          UV <span className="fw-semibold text-white">{formatNumber(uv)}</span>
        </span>
      </span>

      {pos && (
        <div
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            zIndex: 2000,
            minWidth: 240,
            background: 'rgba(33,37,41,0.97)',
            color: '#fff',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 12,
            lineHeight: 1.8,
            boxShadow: '0 6px 20px rgba(0,0,0,0.28)',
            pointerEvents: 'none',
          }}
        >
          <div className="d-flex align-items-center justify-content-between" style={{ gap: 12, marginBottom: 6 }}>
            <span className="fw-semibold">
              本周访问
              {mock && (
                <span
                  className="ms-1"
                  style={{
                    fontSize: 10,
                    padding: '0 4px',
                    borderRadius: 3,
                    color: '#ffd8a8',
                    border: '1px solid rgba(255,216,168,0.45)',
                    verticalAlign: 'middle',
                  }}
                >
                  模拟
                </span>
              )}
            </span>
            {weekStart && <span style={{ color: 'rgba(255,255,255,0.55)' }}>{weekStart} 起</span>}
          </div>
          <div className="d-flex align-items-center" style={{ gap: 14, marginBottom: topPaths.length ? 8 : 0 }}>
            <span>
              浏览量 <span className="fw-semibold">{formatNumber(pv)}</span>
            </span>
            <span>
              访客数 <span className="fw-semibold">{formatNumber(uv)}</span>
            </span>
          </div>
          {topPaths.length > 0 && (
            <>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', margin: '0 0 6px' }}></div>
              <div style={{ color: 'rgba(255,255,255,0.55)', marginBottom: 2 }}>访问最多的报表</div>
              {topPaths.map((item, idx) => (
                <div key={item.path} className="d-flex align-items-center justify-content-between" style={{ gap: 16 }}>
                  <span className="text-truncate" style={{ maxWidth: 150 }} title={item.path}>
                    {idx + 1}. {pathLabel(item.path)}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap' }}>
                    {formatNumber(item.pv)} / {formatNumber(item.uv)}
                  </span>
                </div>
              ))}
              <div style={{ color: 'rgba(255,255,255,0.4)', marginTop: 4, fontSize: 11 }}>右侧为 PV / UV</div>
            </>
          )}
        </div>
      )}
    </>
  );
}
