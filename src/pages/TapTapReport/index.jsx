import { useSearchParams } from 'react-router-dom';
import DownloadStats from './DownloadStats';
import OnlineStats from './OnlineStats';
import TapTapAdStats from './TapTapAdStats';

/**
 * 数据图表选择
 * hidden: 不在「数据图表选择」里显示按钮，但仍可通过 URL ?tab= 或页内快捷入口进入
 */
const CHART_GROUPS = [
  { key: 'download', label: 'TapTap下载统计', desc: '下载趋势 / 热玩游戏 / 明细榜' },
  { key: 'online', label: 'TapPC在线人数统计', desc: '在线峰值 / 分布 / 明细' },
  { key: 'tapAd', label: 'TapTap广告统计', desc: '广告大盘 / 渠道明细' },
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

  const activeGroup = CHART_GROUPS.find((g) => g.key === chartGroup);
  const activeDesc = activeGroup?.hidden ? activeGroup.desc : activeGroup?.desc;

  return (
    <div className="tt-page container-fluid p-4" style={{ maxWidth: 1440, margin: '0 auto' }}>
      {/* 页头 */}
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3">
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.4, color: '#A7B0B8' }}>TAPTAP REPORT</div>
          <h1 style={{ fontSize: 27, fontWeight: 650, letterSpacing: -0.3, color: '#1B2228', margin: '4px 0 0' }}>
            TapTap 报表
          </h1>
          <div style={{ fontSize: 12.5, color: '#8A959E', marginTop: 6 }}>
            下载 · 在线 · 广告 三大口径{activeDesc ? <span style={{ color: '#A7B0B8' }}> · {activeDesc}</span> : null}
          </div>
        </div>
      </div>

      {/* 统计切换：胶囊分段控件 */}
      <div
        className="d-inline-flex flex-wrap"
        style={{ background: '#F2F5F7', borderRadius: 12, padding: 4, marginTop: 20, marginBottom: 20, gap: 2 }}
        role="group"
        aria-label="数据图表选择"
      >
        {VISIBLE_GROUPS.map((g) => {
          const active = chartGroup === g.key;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => setChartGroup(g.key)}
              style={{
                border: 'none',
                background: active ? '#fff' : 'transparent',
                boxShadow: active ? '0 1px 3px rgba(16,24,40,0.10)' : 'none',
                borderRadius: 9,
                padding: '7px 18px',
                fontSize: 12.5,
                fontWeight: active ? 600 : 500,
                color: active ? '#1F272E' : '#71808A',
                cursor: 'pointer',
                transition: 'all .15s',
                whiteSpace: 'nowrap',
              }}
            >
              {g.label}
            </button>
          );
        })}
        {/* 通过快捷入口进入隐藏标签时，提示当前所在统计 */}
        {CHART_GROUPS.find((g) => g.key === chartGroup)?.hidden && (
          <span style={{ fontSize: 11.5, color: '#A7B0B8', alignSelf: 'center', padding: '0 8px' }}>
            当前：{CHART_GROUPS.find((g) => g.key === chartGroup).label}
          </span>
        )}
      </div>

      {chartGroup === 'download' && <DownloadStats />}
      {chartGroup === 'online' && <OnlineStats />}
      {chartGroup === 'tapAd' && <TapTapAdStats />}
    </div>
  );
}
