/* eslint-disable react/only-export-components */
// 本文件是共享工具模块：导出常量 + 工具函数 + 小型展示组件 + 列配置，
// 被 DownloadStats / TapTapAdStats 及广告明细弹框组件复用。
import { GAME_TYPE_META } from './constants';
import { useState } from 'react';
import Sparkline from '../../components/common/Sparkline';
import { formatNumber } from '../../utils/formatters';

/** 统一色库（从 ../../utils/chart-theme 重导出，保持旧引用不变） */
export { AD_MATERIAL_COLORS } from '../../utils/chart-theme';

/** 游戏名称截断：最多10个字，超出用...代替 */
export const truncateName = (name) => {
  const s = name || '';
  return s.length > 10 ? s.slice(0, 10) + '...' : (s || '-');
};

/**
 * 默认游戏图标（icon 为空或加载失败时兜底）：灰底 + 手柄轮廓的内联 SVG，不依赖外网资源
 */
export const DEFAULT_GAME_ICON =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
      '<rect width="32" height="32" rx="7" fill="#dee2e6"/>' +
      '<path d="M11.4 12h9.2a4.8 4.8 0 0 1 4.6 3.4l1.3 4.5a2.8 2.8 0 0 1-5 2.6L19.9 20h-7.8l-1.6 2.5a2.8 2.8 0 0 1-5-2.6l1.3-4.5A4.8 4.8 0 0 1 11.4 12Z" fill="#868e96"/>' +
      '<path d="M12.9 15.4v3.4M11.2 17.1h3.4" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>' +
      '<circle cx="19.4" cy="16.2" r="1.05" fill="#fff"/>' +
      '<circle cx="21.1" cy="17.9" r="1.05" fill="#fff"/>' +
    '</svg>'
  );

/** TapTap 游戏详情页地址（用 APPID 拼接） */
export const taptapAppUrl = (appId) => `https://www.taptap.cn/app/${appId}`;

/**
 * 游戏图标：优先用传入的 icon 地址，空值或加载失败时回落到默认图标。
 * @param {Object} props
 * @param {string} [props.src] 图标地址（数据表 icon 字段）
 * @param {number} [props.size] 边长（px）
 * @param {string} [props.alt] 无障碍文本
 */
export const GameIcon = ({ src, size = 20, alt = '' }) => {
  const [failedSrc, setFailedSrc] = useState(null);
  const useFallback = !src || failedSrc === src;
  return (
    <img
      src={useFallback ? DEFAULT_GAME_ICON : src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
      style={{ width: size, height: size, objectFit: 'cover', borderRadius: 4, flex: '0 0 auto', backgroundColor: '#e9ecef' }}
    />
  );
};

/** 通用百分比进度条（数值居中显示在进度条上，color 缺省用色库中性色） */
export const PercentBar = ({ value, color = '#8FA3B0' }) => {
  if (value == null || Number.isNaN(Number(value))) return <span className="text-muted">-</span>;
  const pct = Math.min(100, Math.max(0, Number(value)));
  return (
    <div className="progress position-relative" style={{ height: 18, backgroundColor: '#e9ecef' }}>
      <div className="progress-bar" style={{ width: `${pct}%`, backgroundColor: color }} />
      <span className="position-absolute top-50 start-50 translate-middle" style={{ fontSize: 11, fontWeight: 600, color: '#333', whiteSpace: 'nowrap' }}>
        {Number(value).toFixed(2)}%
      </span>
    </div>
  );
};

/** TapApp广告素材标签列配色（取自 AD_MATERIAL_COLORS 色库） */
export const APP_AD_TAG_COLORS = {
  tag1: '#7A8B99',
  tag2: '#7D8F7B',
  tag3: '#B08B8B',
};

/** TapPC在线人数Top80游戏列表：游戏类型（distribution_type）→ 标签/配色（统一取自 constants） */
export const PC_GAME_TYPE_META = GAME_TYPE_META;

/** TapPC在线人数Top80游戏列表列配置 */
export const PC_ONLINE_TOP80_COLUMNS = [
  { header: 'APPID', width: '10%', accessor: (r) => r.appId, render: (r) => <span className="text-muted small" style={{ whiteSpace: 'nowrap' }}>{r.appId}</span> },
  {
    header: '游戏名称',
    width: '25%',
    accessor: (r) => r.appName,
    render: (r) => (
      <span className="d-inline-flex align-items-center gap-2" title={r.appName || undefined} style={{ minWidth: 0, maxWidth: '100%' }}>
        <GameIcon src={r.icon} size={20} alt={r.appName ? `${r.appName} 图标` : ''} />
        <span className="fw-semibold" style={{ display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
          {truncateName(r.appName)}
        </span>
      </span>
    ),
  },
  {
    header: '标签',
    width: '18%',
    accessor: (r) => [r.tag1, r.tag2, r.tag3].filter(Boolean).join(' '),
    render: (r) => (
      <div className="d-flex flex-wrap gap-1">
        {r.tag1 && <span className="badge" style={{ backgroundColor: APP_AD_TAG_COLORS.tag1, color: '#fff' }}>{r.tag1}</span>}
        {r.tag2 && <span className="badge" style={{ backgroundColor: APP_AD_TAG_COLORS.tag2, color: '#fff' }}>{r.tag2}</span>}
        {r.tag3 && <span className="badge" style={{ backgroundColor: APP_AD_TAG_COLORS.tag3, color: '#fff' }}>{r.tag3}</span>}
        {!r.tag1 && !r.tag2 && !r.tag3 && <span className="text-muted">-</span>}
      </div>
    ),
  },
  {
    header: '游戏类型',
    width: '10%',
    accessor: (r) => PC_GAME_TYPE_META[r.distributionType]?.label ?? String(r.distributionType ?? ''),
    render: (r) => {
      const meta = PC_GAME_TYPE_META[r.distributionType];
      if (!meta) return <span className="text-muted">-</span>;
      return <span className="badge" style={{ backgroundColor: meta.color, color: '#fff' }}>{meta.label}</span>;
    },
  },
  { header: '在线人数', align: 'end', width: '10%', accessor: (r) => r.onlinePlayers, render: (r) => <span>{formatNumber(r.onlinePlayers)}</span> },
  {
    header: '近24h趋势',
    align: 'center',
    width: '15%',
    help: '为最近24小时内每小时的在线人数趋势，x轴为小时，y轴为该小时的在线人数',
    render: (r) => <Sparkline data={r.trend || []} labels={r.trendLabels || []} width={100} height={30} />,
  },
];



