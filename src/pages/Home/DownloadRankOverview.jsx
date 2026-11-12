import RankSection from './RankSection';
import { fetchDownloadRank, currentMonthKey } from '../../api/home';

/**
 * 本月下载榜 Top5（下载总量 / 新增最多 / 下滑最多）。
 * 数据：everything-api `GET /api/v09/data/home/download-rank`
 *      → MySQL `dws_taptap_download_periodic_rank`（period_type='monthly'）
 */

/** 三个榜的展示文案与配色 */
const CATEGORY_META = {
  top: { title: '下载总量 Top5', desc: '本月累计下载量排名', icon: 'bi-trophy', accent: '#5C6B7A', tint: '#EDF1F5' },
  gain: {
    title: '新增最多 Top5',
    desc: '较上期增量排名',
    icon: 'bi-graph-up-arrow',
    accent: '#7D8F7B',
    tint: '#EEF3EE',
  },
  loss: {
    title: '下滑最多 Top5',
    desc: '较上期降幅排名',
    icon: 'bi-graph-down-arrow',
    accent: '#B08B8B',
    tint: '#F5EFEF',
  },
};

/** 下载量格式化：≥1 亿用亿，≥1 万用万，其余千分位 */
function fmtDownload(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
  return n.toLocaleString('zh-CN');
}

export default function DownloadRankOverview() {
  const month = currentMonthKey();
  return (
    <RankSection
      title="本月下载榜"
      subtitle={`${month} 月度快照 · 下载总量 / 新增最多 / 下滑最多三个榜各取前 5 名`}
      badge={{ text: '每月更新', title: '数据源 dws_taptap_download_periodic_rank，每月更新' }}
      categoryMeta={CATEGORY_META}
      queryKey="home-download-rank"
      fetcher={fetchDownloadRank}
      format={fmtDownload}
      month={month}
    />
  );
}
