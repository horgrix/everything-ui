import RankSection from './RankSection';
import { fetchAdRank, currentMonthKey } from '../../api/home';

/**
 * 本月广告曝光榜 Top5（曝光总量 / 新增最多 / 下滑最多）。
 * 数据：everything-api `GET /api/v09/data/home/ad-rank`
 *      → MySQL `dws_taptap_ad_aggr_v6_periodic_rank`（period_type='monthly'）
 */

/** 三个榜的展示文案与配色（与下载榜同结构、换一套色区分） */
const CATEGORY_META = {
  top: { title: '曝光总量 Top5', desc: '本月广告曝光量排名', icon: 'bi-badge-ad', accent: '#6B7C8C', tint: '#EDF1F5' },
  gain: {
    title: '新增最多 Top5',
    desc: '较上期增量排名',
    icon: 'bi-graph-up-arrow',
    accent: '#5F6F5E',
    tint: '#EEF2EE',
  },
  loss: {
    title: '下滑最多 Top5',
    desc: '较上期降幅排名',
    icon: 'bi-graph-down-arrow',
    accent: '#C4A4A4',
    tint: '#F6F0F0',
  },
};

/** 曝光次数格式化：量级不大，直接千分位 */
function fmtViews(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return Number(v).toLocaleString('zh-CN');
}

export default function AdRankOverview() {
  const month = currentMonthKey();
  return (
    <RankSection
      title="本月广告曝光榜"
      subtitle={`${month} 月度快照 · 曝光总量 / 新增最多 / 下滑最多三个榜各取前 5 名`}
      badge={{ text: '每月更新', title: '数据源 dws_taptap_ad_aggr_v6_periodic_rank，每月更新' }}
      categoryMeta={CATEGORY_META}
      queryKey="home-ad-rank"
      fetcher={fetchAdRank}
      format={fmtViews}
      month={month}
    />
  );
}
