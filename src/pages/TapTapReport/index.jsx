import { useState } from 'react';
import DownloadStats from './DownloadStats';
import OnlineStats from './OnlineStats';
import TapPcAdStats from './TapPcAdStats';
import TapAppAdStats from './TapAppAdStats';

/** 数据图表选择 */
const CHART_GROUPS = [
  { key: 'download', label: 'TapTap下载统计' },
  { key: 'online', label: 'TapPC在线人数统计' },
  { key: 'ad', label: 'TapPC广告统计' },
  { key: 'appAd', label: 'TapApp广告统计' },
];

export default function TapTapReport() {
  const [chartGroup, setChartGroup] = useState('download');

  return (
    <div className="container-fluid p-4">
      <h2 className="fw-bold mb-4">
        <i className="bi bi-controller text-primary me-2"></i>
        TapTap 报表
      </h2>

      {/* 数据图表选择 */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-0 fw-semibold">数据图表选择</div>
        <div className="card-body">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {CHART_GROUPS.map((g) => (
              <button
                key={g.key}
                type="button"
                className={`btn btn-sm ${chartGroup === g.key ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setChartGroup(g.key)}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {chartGroup === 'download' && <DownloadStats />}
      {chartGroup === 'online' && <OnlineStats />}
      {chartGroup === 'ad' && <TapPcAdStats />}
      {chartGroup === 'appAd' && <TapAppAdStats />}
    </div>
  );
}
