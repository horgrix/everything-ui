import ActiveAppsOverview from './ActiveAppsOverview';
import TypeShareOverview from './TypeShareOverview';
import DownloadRankOverview from './DownloadRankOverview';
import AdRankOverview from './AdRankOverview';

/**
 * 首页：平台数据概览。
 * 依次是「本月采集活跃 APP」4 个模块、「本月游戏类型占比」、下载榜 Top5、广告曝光榜 Top5 ——
 * 数据均来自 everything-api 的 /api/v09/data/home/* 聚合接口。
 */
export default function Home() {
  return (
    <div className="home-page container-fluid p-4" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* 页头 */}
      <div className="mb-4">
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.4, color: '#A7B0B8' }}>DATA PLATFORM</div>
        <h1 style={{ fontSize: 27, fontWeight: 650, letterSpacing: -0.3, color: '#1B2228', margin: '4px 0 0' }}>
          数据可视化平台
        </h1>
        <div style={{ fontSize: 12.5, color: '#8A959E', marginTop: 6 }}>
          游戏线索查询、TapTap 平台数据与财务 / 量化指标的统一入口
        </div>
      </div>

      {/* 本月采集活跃 APP 数（4 个模块） */}
      <ActiveAppsOverview />

      {/* 本月游戏类型占比（下载 / 在线 / 广告） */}
      <TypeShareOverview />

      {/* 本月下载榜 Top5（总量 / 新增 / 下滑） */}
      <DownloadRankOverview />

      {/* 本月广告曝光榜 Top5（总量 / 新增 / 下滑） */}
      <AdRankOverview />
    </div>
  );
}
