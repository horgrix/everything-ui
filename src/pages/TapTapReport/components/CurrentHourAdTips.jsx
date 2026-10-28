import { useEffect, useState } from 'react';
import { useSqlQuery } from '../queries';
import { buildCurrentHourAdSnapshotSql, currentHourKey, isCurrentHourReady, SNAPSHOT_GRACE_MINUTES } from '../sql';
import { transformCurrentHourAdSnapshot } from '../transforms';
import { GameIcon, truncateName } from '../shared';

/**
 * 每个渠道在弹框里的展示配置：标题 + 分组键
 */
const GROUPS = [
  { key: 'home', label: 'APP首页广告' },
  { key: 'keyword', label: '关键词广告' },
  { key: 'pc', label: 'PC广告' },
];

/** 弹框宽度（视口不够时自动收窄） */
const BOX_WIDTH = 720;
/** 弹框内每个渠道表格的滚动高度 */
const LIST_MAX_HEIGHT = 300;

/** 平台图标配置：iOS 苹果、Android 安卓（行尾展示，PC 组无平台不显示） */
const PLATFORM_ICONS = {
  ios: { icon: 'bi-apple', label: 'iOS', color: '#212529' },
  android: { icon: 'bi-android2', label: 'Android', color: '#0f9d58' },
};

/** 单行：游戏 ICON + 游戏名称 + 行尾平台图标 */
function GameRow({ game }) {
  const name = game.appName || (game.appId ? `APPID ${game.appId}` : '未知游戏');
  const platform = PLATFORM_ICONS[game.platform];
  return (
    <div className="d-flex align-items-center gap-2" style={{ padding: '3px 4px', borderRadius: 4 }}>
      <GameIcon src={game.icon} size={18} alt={game.appName ? `${game.appName} 图标` : ''} />
      <span style={{ fontSize: 12, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>
        {truncateName(name)}
      </span>
      {platform && (
        <i
          className={`bi ${platform.icon}`}
          title={platform.label}
          style={{ marginLeft: 'auto', fontSize: 11, color: platform.color, flex: '0 0 auto' }}
        ></i>
      )}
    </div>
  );
}

/** 弹框里的一个渠道表格 */
function GroupTable({ label, games, loading }) {
  return (
    <div style={{ flex: '1 1 200px', minWidth: 180 }}>
      <div className="d-flex align-items-center justify-content-between mb-1">
        <span className="fw-semibold" style={{ fontSize: 12 }}>{label}</span>
        <span className="text-muted" style={{ fontSize: 11 }}>{loading ? '…' : `${games.length} 个`}</span>
      </div>
      <div style={{ maxHeight: LIST_MAX_HEIGHT, overflowY: 'auto', borderTop: '1px solid #eee' }}>
        {games.length === 0 ? (
          <div className="text-muted" style={{ fontSize: 11, padding: '6px 4px' }}>{loading ? '加载中…' : '本时段无数据'}</div>
        ) : (
          games.map((g) => <GameRow key={`${g.appId}-${g.platform}-${g.appName}`} game={g} />)
        )}
      </div>
    </div>
  );
}

/**
 * 「本时段抓取到的广告」提示标签：悬停弹出当前小时 首页/关键词/PC 三个渠道抓到的广告游戏。
 * 弹框用 fixed 定位，避免被卡片或表格容器裁剪。
 */
export default function CurrentHourAdTips() {
  const [pos, setPos] = useState(null);
  // 每 30 秒触发一次重渲染，保证整点切换小时、以及过 :15 切换到当前小时
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30 * 1000);
    return () => clearInterval(timer);
  }, []);
  // 当前小时不满 15 分钟时 currentHourKey() 会回退到上一小时，避免查到空数据
  const hour = currentHourKey();
  const hourReady = isCurrentHourReady();
  const { data, isLoading, error } = useSqlQuery(
    'taptap-current-hour-ad-snapshot',
    () => buildCurrentHourAdSnapshotSql(hour),
    [hour],
    transformCurrentHourAdSnapshot,
    { staleTime: 60 * 1000 },
  );

  const groups = data || { home: [], keyword: [], pc: [] };
  const total = groups.home.length + groups.keyword.length + groups.pc.length;

  const handleEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const boxWidth = Math.min(BOX_WIDTH, window.innerWidth - 24);
    // 右边缘对齐标签右边缘，并夹在视口内
    const left = Math.max(12, Math.min(rect.right - boxWidth, window.innerWidth - boxWidth - 12));
    setPos({ left, top: rect.bottom + 6, width: boxWidth });
  };

  return (
    <span
      className="d-inline-flex align-items-center gap-1"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setPos(null)}
      style={{ position: 'relative' }}
    >
      <span
        className="badge border text-secondary d-inline-flex align-items-center gap-1"
        style={{ backgroundColor: '#f8f9fa', fontWeight: 500, cursor: 'help' }}
      >
        <i className="bi bi-search" style={{ fontSize: 10 }}></i>
        <span>本时段 {hour}:00:00 抓取到的广告</span>
      </span>

      {pos && (
        <div
          style={{
            position: 'fixed',
            left: pos.left,
            top: pos.top,
            width: pos.width,
            maxHeight: 430,
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid #dee2e6',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: '10px 12px',
            zIndex: 2000,
            textAlign: 'left',
          }}
        >
          <div className="d-flex align-items-center justify-content-between mb-2">
            <span className="fw-semibold" style={{ fontSize: 12 }}>本时段抓取到的广告</span>
            <span className="text-muted" style={{ fontSize: 11 }}>
              {hour}:00:00 · 共 {total} 个游戏
            </span>
          </div>
          {!hourReady && (
            <div className="text-muted mb-2" style={{ fontSize: 11 }}>
              当前小时未满 {SNAPSHOT_GRACE_MINUTES} 分钟，先展示上一小时的数据
            </div>
          )}
          {error ? (
            <div className="text-danger" style={{ fontSize: 12 }}>
              <i className="bi bi-exclamation-triangle me-1"></i>
              {error.message}
            </div>
          ) : (
            <div className="d-flex flex-wrap" style={{ gap: 12 }}>
              {GROUPS.map((g) => (
                <GroupTable key={g.key} label={g.label} games={groups[g.key] || []} loading={isLoading} />
              ))}
            </div>
          )}
        </div>
      )}
    </span>
  );
}
