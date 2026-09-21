import DashboardCard from '../../../components/layout/DashboardCard';
import { formatNumber } from '../../../utils/formatters';

/** KPI 指标项配置 */
const KPI_ITEMS = [
  { key: 'totalDownload', label: '总下载数', icon: 'bi-download', color: 'dark', format: (v) => formatNumber(v) },
  { key: 'pcDownload', label: 'PC下载数', icon: 'bi-pc-display', color: 'primary', format: (v) => formatNumber(v) },
  { key: 'mobileDownload', label: '移动下载数', icon: 'bi-phone', color: 'info', format: (v) => formatNumber(v) },
  { key: 'pcRatio', label: 'PC占比', icon: 'bi-percent', color: 'success', format: (v) => `${v}%` },
];

/** KPI 指标行，suffix 追加到标题后 */
export default function KpiRow({ data, suffix = '' }) {
  return (
    <div className="row g-3 mb-4">
      {KPI_ITEMS.map((item) => (
        <div className="col-6 col-md-3" key={item.key}>
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
