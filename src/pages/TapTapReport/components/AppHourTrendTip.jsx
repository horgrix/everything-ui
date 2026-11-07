import { useState } from 'react';
import LineChart from '../../../components/charts/LineChart';
import { useSqlQuery } from '../queries';
import { buildAppHourTrendSql } from '../sql';
import { formatNumber } from '../../../utils/formatters';

/** 弹框宽度（视口不够时自动收窄） */
const BOX_WIDTH = 420;

/** 折线/面积颜色（与平台、小游戏系列配色一致） */
const METRIC_COLORS = {
  app_download_count: '#7A8B99',
  pc_download_count: '#9CAF9F',
  download_count: '#8FA3B0',
};

/** SQL 行 → { categories, series } */
function transformHourTrend(rows) {
  const list = rows || [];
  return {
    categories: list.map((r) => String(r.crawled_at || '').slice(11, 13) + ':00'),
    values: list.map((r) => Number(r.value || 0)),
  };
}

/**
 * 下载 Top25 明细「下载数」后的趋势图标：悬停弹出该游戏在其统计窗口当天的按小时下载趋势。
 * 数据源 dws_taptap_download_v2_hourly，取数列与明细表当前口径一致
 * （平台表：APP/PC/总下载数；小游戏表：总下载数）。
 *
 * @param {string|number} appId 游戏 ID
 * @param {string} appName 游戏名（弹框标题用）
 * @param {string} metric 取值列 app_download_count / pc_download_count / download_count
 * @param {string} metricLabel 指标名（弹框副标题用，如「APP下载数」）
 * @param {string} day 统计窗口对应的日期，形如 2026-11-07
 */
export default function AppHourTrendTip({ appId, appName, metric = 'download_count', metricLabel = '下载数', day }) {
  const [pos, setPos] = useState(null);
  // 首次悬停才拉数据，避免一次渲染几十个请求
  const [enabled, setEnabled] = useState(false);

  const trendQuery = useSqlQuery(
    `taptap-app-hour-trend-${appId}-${day}-${metric}`,
    () => buildAppHourTrendSql(appId, day, metric),
    [appId, day, metric],
    transformHourTrend,
    { enabled }
  );

  const handleEnter = (e) => {
    setEnabled(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const boxWidth = Math.min(BOX_WIDTH, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left - boxWidth + rect.width, window.innerWidth - boxWidth - 12));
    const spaceBelow = window.innerHeight - rect.bottom - 16;
    const spaceAbove = rect.top - 16;
    const openAbove = spaceBelow < 300 && spaceAbove > spaceBelow;
    setPos(
      openAbove
        ? { left, bottom: window.innerHeight - rect.top + 6, width: boxWidth, maxHeight: Math.max(220, spaceAbove) }
        : { left, top: rect.bottom + 6, width: boxWidth, maxHeight: Math.max(220, spaceBelow) }
    );
  };

  const categories = trendQuery.data?.categories || [];
  const values = trendQuery.data?.values || [];
  const total = values.reduce((a, b) => a + (Number(b) || 0), 0);
  const color = METRIC_COLORS[metric] || METRIC_COLORS.download_count;

  return (
    <span
      className="d-inline-flex align-items-center"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setPos(null)}
      style={{ position: 'relative' }}
    >
      <i
        className="bi bi-graph-up"
        role="img"
        aria-label="下载趋势"
        title={`${appName || appId} · ${metricLabel} · 当日按小时趋势`}
        style={{ cursor: 'help', fontSize: 13, color: '#4361ee' }}
      ></i>

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
          <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
            <span className="fw-semibold" style={{ fontSize: 12 }}>
              {appName || `APPID ${appId}`} · {metricLabel}
            </span>
            <span className="text-muted" style={{ fontSize: 11 }}>
              {day} 合计 {formatNumber(total)}
            </span>
          </div>
          <div className="text-muted mb-1" style={{ fontSize: 11 }}>
            APPID {appId} · 当日按小时趋势（dws_taptap_download_v2_hourly）
          </div>
          {trendQuery.isLoading ? (
            <div className="text-muted" style={{ fontSize: 12, padding: '24px 0', textAlign: 'center' }}>
              加载中…
            </div>
          ) : trendQuery.error ? (
            <div className="text-muted" style={{ fontSize: 12, padding: '24px 0', textAlign: 'center' }}>
              趋势加载失败
            </div>
          ) : categories.length === 0 ? (
            <div className="text-muted" style={{ fontSize: 12, padding: '24px 0', textAlign: 'center' }}>
              当日暂无分时数据
            </div>
          ) : (
            <LineChart
              series={[{ name: metricLabel, data: values }]}
              height={170}
              toolbar={false}
              area
              strokeWidth={2}
              colors={[color]}
              markers={{ size: 3, hover: { size: 6 } }}
              /* 显式 category 轴：LineChart 默认 datetime，只传 categories 会渲染空白 */
              xaxisOverrides={{ type: 'category', categories, labels: { rotate: 0, style: { fontSize: '10px' } } }}
              yaxisOverrides={{ labels: { formatter: (v) => formatNumber(v), style: { fontSize: '10px' } } }}
              legendOverrides={{ show: false }}
            />
          )}
        </div>
      )}
    </span>
  );
}
