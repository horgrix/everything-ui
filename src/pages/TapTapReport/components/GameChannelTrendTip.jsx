import { useState } from 'react';
import MixedChart from '../../../components/charts/MixedChart';
import { formatNumber } from '../../../utils/formatters';

/** 弹框宽度（视口不够时自动收窄） */
const BOX_WIDTH = 460;

/** 三个渠道的折线定义：名称 + 取值字段 + 颜色 */
const SERIES = [
  { key: 'app', name: 'APP首页广告', color: '#f08c00' },
  { key: 'pc', name: 'PC首页广告', color: '#7209b7' },
  { key: 'kw', name: 'APP搜索关键词广告', color: '#d6336c' },
];

/**
 * 【广告大盘】本周游戏明细「详细趋势」列：info 图标 + 悬停折线图。
 * 折线为本周每日的三渠道广告数：
 *   APP首页广告 = app_ad_views + app_pcebid_views
 *   PC首页广告 = pc_ad_views + pc_pcebid_views
 *   APP搜索关键词广告 = kw_ad_views + kw_pcebid_views
 *
 * @param {string} appName 游戏名（弹框标题用）
 * @param {{app:number[],pc:number[],kw:number[]}} trend 周一 → 周日 7 个点
 * @param {string[]} labels x 轴标签（周一…周日）
 */
export default function GameChannelTrendTip({ appName, trend, labels }) {
  const [pos, setPos] = useState(null);

  const handleEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const boxWidth = Math.min(BOX_WIDTH, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left - boxWidth + rect.width, window.innerWidth - boxWidth - 12));
    // 下方空间不足 320px 时向上展开，保证整框落在视口内
    const spaceBelow = window.innerHeight - rect.bottom - 16;
    const spaceAbove = rect.top - 16;
    const openAbove = spaceBelow < 320 && spaceAbove > spaceBelow;
    setPos(
      openAbove
        ? { left, bottom: window.innerHeight - rect.top + 6, width: boxWidth, maxHeight: Math.max(240, spaceAbove) }
        : { left, top: rect.bottom + 6, width: boxWidth, maxHeight: Math.max(240, spaceBelow) },
    );
  };

  const values = trend || { app: [], pc: [], kw: [] };
  const series = SERIES.map((s) => ({ name: s.name, type: 'line', data: values[s.key] || [] }));
  const total = (key) => (values[key] || []).reduce((a, b) => a + (Number(b) || 0), 0);

  return (
    <span
      className="d-inline-flex align-items-center"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setPos(null)}
      style={{ position: 'relative' }}
    >
      <i className="bi bi-graph-up" style={{ cursor: 'help', fontSize: 14, color: '#4361ee' }} title="详细趋势（本周三渠道折线）"></i>

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
          <div className="d-flex align-items-center justify-content-between mb-1">
            <span className="fw-semibold" style={{ fontSize: 12 }}>{appName || '详细趋势'} · 本周</span>
            <span className="text-muted" style={{ fontSize: 11 }}>
              合计 {formatNumber(total('app') + total('pc') + total('kw'))}
            </span>
          </div>
          <div className="text-muted mb-1" style={{ fontSize: 11 }}>
            APP首页、PC首页、APP搜索关键词三渠道每日广告数（*_ad_views + *_pcebid_views）
          </div>
          <MixedChart
            series={series}
            height={200}
            toolbar={false}
            colors={SERIES.map((s) => s.color)}
            strokeWidths={[3, 3, 3]}
            markers={{ size: 4, hover: { size: 8 } }}
            fill={{ opacity: 1 }}
            tooltipY={(v) => (v == null ? '-' : formatNumber(v))}
            /* 必须显式 type='category'：MixedChart 默认带 datetime 轴，只传 categories 会渲染空白 */
            xaxisOverrides={{ type: 'category', categories: labels || [], labels: { rotate: 0 } }}
            yaxisLeft={{ labels: { formatter: (v) => formatNumber(v) } }}
            legend={{ position: 'bottom', horizontalAlign: 'center', fontSize: '11px', itemMargin: { horizontal: 6, vertical: 2 }, markers: { size: 4 } }}
          />
        </div>
      )}
    </span>
  );
}
