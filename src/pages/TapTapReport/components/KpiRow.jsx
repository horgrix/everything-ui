import DashboardCard from '../../../components/layout/DashboardCard';
import { formatNumber } from '../../../utils/formatters';

/** KPI 指标项配置（汇总/历史两套共用） */
const KPI_ITEMS = [
  { key: 'pcDownload', label: 'PC下载数', icon: 'bi-pc-display', color: 'primary', format: (v) => formatNumber(v) },
  { key: 'mobileDownload', label: '移动下载数', icon: 'bi-phone', color: 'info', format: (v) => formatNumber(v) },
  { key: 'pcRatio', label: 'PC占比', icon: 'bi-percent', color: 'success', format: (v) => `${v}%` },
  { key: 'fansCount', label: '关注数', icon: 'bi-heart', color: 'danger', format: (v) => formatNumber(v) },
  { key: 'reviewCount', label: '评价数', icon: 'bi-chat', color: 'warning', format: (v) => formatNumber(v) },
  { key: 'wishCount', label: '收藏数', icon: 'bi-star', color: 'secondary', format: (v) => formatNumber(v) },
];

/** KPI 指标行，suffix 追加到标题后（如 "(历史)"） */
export default function KpiRow({ data, suffix = '' }) {
  return (
    <div className="row g-3 mb-4">
      {KPI_ITEMS.map((item) => (
        <div className="col-6 col-md-2" key={item.key}>
          <DashboardCard
            title={`${item.label}${suffix}`}
            value={data?.[item.key] != null ? item.format(data[item.key]) : '-'}
            icon={item.icon}
            color={item.color}
          />
        </div>
      ))}
    </div>
  );
}
