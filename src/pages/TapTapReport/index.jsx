import { useSearchParams } from 'react-router-dom';
import DownloadStats from './DownloadStats';
import OnlineStats from './OnlineStats';
import TapTapAdStats from './TapTapAdStats';

/**
 * 数据图表选择
 * hidden: 不在「数据图表选择」里显示按钮，但仍可通过 URL ?tab= 或页内快捷入口进入
 */
const CHART_GROUPS = [
  { key: 'download', label: 'TapTap下载统计' },
  { key: 'online', label: 'TapPC在线人数统计' },
  { key: 'tapAd', label: 'TapTap广告统计' },
];

const DEFAULT_GROUP = 'download';
const GROUP_KEYS = CHART_GROUPS.map((g) => g.key);
/** 只渲染未隐藏的标签按钮 */
const VISIBLE_GROUPS = CHART_GROUPS.filter((g) => !g.hidden);

export default function TapTapReport() {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get('tab');
  const chartGroup = GROUP_KEYS.includes(param) ? param : DEFAULT_GROUP;

  const setChartGroup = (key) => {
    const next = new URLSearchParams(searchParams);
    if (key === DEFAULT_GROUP) next.delete('tab');
    else next.set('tab', key);
    setSearchParams(next, { replace: true });
  };

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
            {VISIBLE_GROUPS.map((g) => (
              <button
                key={g.key}
                type="button"
                className={`btn btn-sm ${chartGroup === g.key ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setChartGroup(g.key)}
              >
                {g.label}
              </button>
            ))}
            {/* 通过快捷入口进入隐藏标签时，提示当前所在统计 */}
            {CHART_GROUPS.find((g) => g.key === chartGroup)?.hidden && (
              <span className="small text-muted">
                当前：<span className="fw-semibold">{CHART_GROUPS.find((g) => g.key === chartGroup).label}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {chartGroup === 'download' && <DownloadStats />}
      {chartGroup === 'online' && <OnlineStats />}
      {chartGroup === 'tapAd' && <TapTapAdStats />}
    </div>
  );
}
