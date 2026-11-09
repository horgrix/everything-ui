import { formatNumber } from '../../../utils/formatters';
import AppHourTrendTip from '../components/AppHourTrendTip';
import { APP_AD_TAG_COLORS, GameIcon, taptapAppUrl } from '../shared';
import { DISTRIBUTION_TYPE_LABELS, DISTRIBUTION_TYPE_BADGE_COLORS, PLATFORM_BADGE_COLORS } from './constants';

/** 下载Top25明细拆分表配置 */
export const TOP25_DETAIL_TABLES = {
  // 平台版：按饼图选中的 refer 查 Top25（app / pc；全部 = app+pc 全平台）
  platform: { title: '下载Top25明细(平台)', limit: 25, referDriven: true, withPlatform: true, rankWidth: '5%' },
  // 小游戏版：按饼图选中的 distribution_type 查 Top25（1=独立小游戏、2=Maker小游戏；全部则两类都查）
  gameType: { title: '下载Top25明细(小游戏)', limit: 25, typeDriven: true, withType: true, rankWidth: '5%' },
};

/** OneSearch 线索查询路由（站内相对路径，开发/生产都指向当前站点，用 APPID 拼接 q 参数） */
const ONESEARCH_REPORT_PATH = '/one-search/report';

/**
 * 下载Top25明细表格列（游戏名称 / icon / 标签 从全局映射获取）
 * @param {Object} gameMap app_id -> { name, icon, tags }
 * @param {boolean} withOneSearch 是否在「下载数」后追加 OneSearch 跳转列（仅 APP / PC 两张宽表）
 */
/** 取一行的名称/图标/标签：优先用明细行自带（v2 小时表），否则回落到 gameMap（日/月表） */
export function rowMeta(r, gameMap) {
  const fromMap = gameMap?.[String(r.appId)];
  return {
    name: r.appName || fromMap?.name || '',
    icon: r.icon || fromMap?.icon || '',
    tags: r.tags?.length ? r.tags : (fromMap?.tags || []),
  };
}

export const TOP25_DETAIL_COLUMNS = (
  gameMap,
  { withOneSearch = false, withPlatform = false, withType = false, trend = null } = {}
) => {
  // 列宽分摊（rank 列宽由调用方传入）：带趋势列后重新分配
  const W = withType
    ? { appId: '8%', tags: '20%', extra: '12%', name: '19%', total: '10%', count: '10%', trend: '6%', search: '10%' }
    : withPlatform
      ? { appId: '8%', tags: '21%', extra: '8%', name: '20%', total: '10%', count: '10%', trend: '6%', search: '9%' }
      : withOneSearch
        ? { appId: '12%', tags: '15%', name: '26%', total: '10%', count: '14%', trend: '6%', search: '15%' }
        : { appId: '14%', tags: '20%', name: '32%', total: '10%', count: '18%', trend: '6%' };

  return [
    {
      header: 'AppID',
      width: W.appId,
      accessor: (r) => r.appId,
      render: (r) => (
        <a
          href={taptapAppUrl(r.appId)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-decoration-none small"
          style={{ color: '#4361ee', whiteSpace: 'nowrap' }}
          title={`在 TapTap 打开（APPID ${r.appId}）`}
        >
          {r.appId}
        </a>
      ),
    },
    {
      header: '标签',
      width: W.tags,
      accessor: (r) => rowMeta(r, gameMap).tags.join(' '),
      render: (r) => {
        const tags = rowMeta(r, gameMap).tags;
        if (!tags.length) return <span className="text-muted">-</span>;
        return (
          <div className="d-flex flex-wrap gap-1">
            {tags.map((tag, i) => (
              <span
                key={`${tag}-${i}`}
                className="badge"
                style={{ backgroundColor: APP_AD_TAG_COLORS[`tag${i + 1}`], color: '#fff', fontSize: 10, padding: '2px 5px', fontWeight: 500 }}
              >
                {tag}
              </span>
            ))}
          </div>
        );
      },
    },
    ...(withPlatform
      ? [
          {
            header: '下载平台',
            width: W.extra,
            accessor: (r) => r.refer || '',
            render: (r) => {
              const raw = (r.refer || '').toLowerCase();
              if (!raw || raw === '-') return <span className="text-muted">-</span>;
              const label = raw === 'app+pc' ? 'APP+PC' : raw === 'pc' ? 'PC' : raw === 'app' ? 'APP' : r.refer;
              return (
                <span
                  className="badge"
                  style={{
                    backgroundColor: PLATFORM_BADGE_COLORS[raw] || '#8FA3B0',
                    color: '#fff',
                    fontSize: 10,
                    padding: '2px 6px',
                    fontWeight: 500,
                  }}
                >
                  {label}
                </span>
              );
            },
          },
        ]
      : []),
    ...(withType
      ? [
          {
            header: '游戏类型',
            width: W.extra,
            accessor: (r) => DISTRIBUTION_TYPE_LABELS[r.distributionType] || '',
            render: (r) => {
              const type = r.distributionType;
              const label = DISTRIBUTION_TYPE_LABELS[type];
              if (!label) return <span className="text-muted">-</span>;
              return (
                <span
                  className="badge"
                  style={{
                    backgroundColor: DISTRIBUTION_TYPE_BADGE_COLORS[type] || '#8FA3B0',
                    color: '#fff',
                    fontSize: 10,
                    padding: '2px 6px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </span>
              );
            },
          },
        ]
      : []),
    {
      header: '游戏名称',
      width: W.name,
      accessor: (r) => rowMeta(r, gameMap).name,
      render: (r) => {
        const meta = rowMeta(r, gameMap);
        const name = meta.name || '';
        return (
          <span className="d-inline-flex align-items-center gap-2" title={name || undefined} style={{ minWidth: 0, maxWidth: '100%' }}>
            <GameIcon src={meta.icon} size={20} alt={name ? `${name} 图标` : ''} />
            <span className="fw-semibold" style={{ display: 'inline-block', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
              {name || '-'}
            </span>
          </span>
        );
      },
    },
    {
      header: '历史下载数',
      align: 'end',
      width: W.total,
      accessor: (r) => r.totalDownloadCount,
      render: (r) =>
        r.totalDownloadCount == null ? (
          <span className="text-muted">-</span>
        ) : (
          <span className="text-muted">{formatNumber(r.totalDownloadCount)}</span>
        ),
    },
    { header: '下载数', align: 'end', width: W.count, accessor: (r) => r.downloadCount, render: (r) => <span className="fw-semibold">{formatNumber(r.downloadCount)}</span> },
    ...(trend
      ? [
          {
            header: '趋势',
            align: 'center',
            width: W.trend,
            render: (r) => (
              <AppHourTrendTip
                appId={r.appId}
                appName={rowMeta(r, gameMap).name}
                metric={trend.metric}
                metricLabel={trend.label}
                day={trend.day}
              />
            ),
          },
        ]
      : []),
    ...(withOneSearch
      ? [
          {
            header: 'OneSearch',
            align: 'center',
            width: W.search,
            render: (r) => (
              <a
                href={`${ONESEARCH_REPORT_PATH}?q=${r.appId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-decoration-none d-inline-flex align-items-center gap-1"
                style={{ color: '#4361ee', fontSize: 12, whiteSpace: 'nowrap' }}
                title={`在 OneSearch 查询 ${r.appId} 的下载 / 在线 / 投放数据`}
              >
                <i className="bi bi-search" aria-hidden="true"></i>
                Search
              </a>
            ),
          },
        ]
      : []),
  ];
};
