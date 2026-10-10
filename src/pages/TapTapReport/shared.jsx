/* eslint-disable react/only-export-components */
// 本文件是共享工具模块：导出常量 + 工具函数 + 小型展示组件 + 列配置，
// 被 TapPcAdStats / TapAppAdStats / DownloadStats 复用。
import { useState } from 'react';
import Sparkline from '../../components/common/Sparkline';
import { formatNumber } from '../../utils/formatters';

/** TapPC广告投放素材分布 Treemap 颜色库 */
export const AD_MATERIAL_COLORS = [
  '#7A8B99', '#9CAF9F', '#C4A4A4', '#D6C9B0', '#9B93A8',
  '#8FA3B0', '#7D8F7B', '#D0B4B4', '#BFAE8E', '#B4AEC0',
  '#5C6B7A', '#8A8F6B', '#B08B8B', '#C9B79C', '#A0A0A0',
  '#A9BAC4', '#A8BFAE', '#C9B6C0', '#A6947E', '#B0AAA4',
  '#6B7C8C', '#5F6F5E', '#B9A2AE', '#D8CFC0', '#6E6E6E',
];

/** 游戏名称截断：最多10个字，超出用...代替 */
export const truncateName = (name) => {
  const s = name || '';
  return s.length > 10 ? s.slice(0, 10) + '...' : (s || '-');
};

/** 广告投放比进度条颜色（分段：<25 / 25-50 / 50-75 / >=75） */
export const adDeliveryRateColor = (rate) => {
  if (rate == null) return '#dee2e6';
  if (rate < 25) return '#9CAF9F';
  if (rate < 50) return '#D6C9B0';
  if (rate < 75) return '#D0B4B4';
  return '#B08B8B';
};

/** 百分比进度条（分段颜色 + 数字居中显示在进度条上） */
export const RateBar = ({ rate }) => {
  if (rate == null) return <span className="text-muted">-</span>;
  const pct = Math.min(100, Math.max(0, rate));
  return (
    <div className="progress position-relative" style={{ height: 18, backgroundColor: '#e9ecef' }}>
      <div className="progress-bar" style={{ width: `${pct}%`, backgroundColor: adDeliveryRateColor(rate) }} />
      <span className="position-absolute top-50 start-50 translate-middle" style={{ fontSize: 11, fontWeight: 600, color: '#333', whiteSpace: 'nowrap' }}>
        {rate}%
      </span>
    </div>
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

/** 平台堆叠 bar（iOS + Android，总数居中，悬停显示平台明细；分平台缺失时显示整体总数） */
export const PlatformBar = ({ ios = 0, android = 0, total: totalProp }) => {
  const [pos, setPos] = useState(null);
  const i = Number(ios) || 0;
  const a = Number(android) || 0;
  const sum = i + a;
  const total = sum > 0 ? sum : (Number(totalProp) || 0);
  if (total === 0) return <span className="text-muted">-</span>;
  if (sum === 0) {
    return (
      <div className="position-relative" style={{ height: 18, backgroundColor: '#e9ecef', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundColor: '#9CAF9F' }} />
        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#333' }}>
          {total}
        </span>
      </div>
    );
  }
  const iosPct = (i / total) * 100;
  const androidPct = (a / total) * 100;
  return (
    <div
      className="position-relative"
      style={{ height: 18, backgroundColor: '#e9ecef', borderRadius: 4, overflow: 'hidden' }}
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPos({ x: rect.left + rect.width / 2, y: rect.bottom + 6 });
      }}
      onMouseLeave={() => setPos(null)}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${iosPct}%`, backgroundColor: '#A9BAC4' }} />
      <div style={{ position: 'absolute', left: `${iosPct}%`, top: 0, bottom: 0, width: `${androidPct}%`, backgroundColor: '#9CAF9F' }} />
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#333', pointerEvents: 'none' }}>
        {total}
      </span>
      {pos && (
        <div style={{
          position: 'fixed', left: pos.x, top: pos.y, transform: 'translateX(-50%)',
          background: 'rgba(33,37,41,0.95)', color: '#fff', padding: '6px 8px',
          borderRadius: 6, fontSize: 12, lineHeight: 1.6, whiteSpace: 'nowrap', zIndex: 2000, pointerEvents: 'none',
        }}>
          iOS：{i}　Android：{a}
        </div>
      )}
    </div>
  );
};

/** TapApp广告素材标签列配色（取自 AD_MATERIAL_COLORS 色库） */
export const APP_AD_TAG_COLORS = {
  tag1: '#7A8B99',
  tag2: '#7D8F7B',
  tag3: '#B08B8B',
};

/** TapPC在线人数Top20游戏列表：游戏来源（list_type）→ 标签/配色（与来源分布图色一致） */
export const PC_GAME_SOURCE_META = {
  pc_played: { label: 'PC', color: '#5C6B7A' },
  pc_emulator_played: { label: '模拟器', color: '#8A8F6B' },
  app_hot_creative: { label: '小游戏', color: '#B08B8B' },
};

/** TapPC在线人数Top20游戏列表：游戏类型（distribution_type）→ 标签/配色 */
export const PC_GAME_TYPE_META = {
  0: { label: '商业游戏', color: '#8FA3B0' },
  1: { label: '创意工坊', color: '#C9B79C' },
  2: { label: 'TapMaker', color: '#B9A2AE' },
};

/** TapPC在线人数Top20游戏列表列配置 */
export const PC_ONLINE_TOP20_COLUMNS = [
  { header: 'APPID', width: '8%', accessor: (r) => r.appId, render: (r) => <span className="text-muted small">{r.appId}</span> },
  {
    header: '游戏名称',
    width: '12%',
    accessor: (r) => r.appName,
    render: (r) => <span className="fw-semibold" title={r.appName || undefined} style={{ whiteSpace: 'nowrap' }}>{truncateName(r.appName)}</span>,
  },
  {
    header: '标签',
    width: '20%',
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
    header: '游戏来源',
    width: '7%',
    accessor: (r) => PC_GAME_SOURCE_META[r.listType]?.label ?? String(r.listType ?? ''),
    render: (r) => {
      const meta = PC_GAME_SOURCE_META[r.listType];
      if (!meta) return <span className="text-muted">-</span>;
      return <span className="badge" style={{ backgroundColor: meta.color, color: '#fff' }}>{meta.label}</span>;
    },
  },
  {
    header: '游戏类型',
    width: '8%',
    accessor: (r) => PC_GAME_TYPE_META[r.distributionType]?.label ?? String(r.distributionType ?? ''),
    render: (r) => {
      const meta = PC_GAME_TYPE_META[r.distributionType];
      if (!meta) return <span className="text-muted">-</span>;
      return <span className="badge" style={{ backgroundColor: meta.color, color: '#fff' }}>{meta.label}</span>;
    },
  },
  { header: '在线人数', align: 'end', width: '6%', accessor: (r) => r.onlinePlayers, render: (r) => <span>{formatNumber(r.onlinePlayers)}</span> },
  {
    header: '最近24小时在线人数',
    align: 'center',
    width: '16%',
    help: '为最近24小时内每小时的在线人数趋势，x轴为小时，y轴为该小时的在线人数',
    render: (r) => <Sparkline data={r.trend || []} labels={r.trendLabels || []} width={120} height={32} />,
  },
  {
    header: 'DAU贡献度',
    align: 'center',
    width: '9%',
    accessor: (r) => r.dauContribution,
    help: 'DAU贡献度 = 在线人数 / 总在线人数（总在线人数取 dws_taptap_pc_online_peak_players_hourly 最新窗口的 online_players）',
    render: (r) => <PercentBar value={r.dauContribution} color="#8FA3B0" />,
  },
  {
    header: '游戏类型占比',
    align: 'center',
    width: '9%',
    accessor: (r) => r.typeContribution,
    help: '游戏类型占比 = 在线人数 / 该游戏来源的总在线人数（PC=pc_online_players；模拟器=pc_emulator_online_players；小游戏=creative_online_players）',
    render: (r) => <PercentBar value={r.typeContribution} color="#9CAF9F" />,
  },
];

/** 每日新发现游戏列表列配置 */
export const AD_GAME_LIST_COLUMNS = [
  { header: 'APPID', accessor: (r) => r.appId, render: (r) => <span className="text-muted small">{r.appId}</span> },
  { header: '游戏名称', width: 170, accessor: (r) => r.appName, render: (r) => <span className="fw-semibold" title={r.appName || undefined} style={{ whiteSpace: 'nowrap' }}>{truncateName(r.appName)}</span> },
  {
    header: '标签',
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
  { header: '曝光次数', align: 'end', accessor: (r) => r.showCnt, render: (r) => <span>{formatNumber(r.showCnt)}</span> },
  { header: '广告投放次数', align: 'end', accessor: (r) => r.adCnt, render: (r) => <span>{formatNumber(r.adCnt)}</span> },
  { header: '投放趋势', align: 'center', render: (r) => <Sparkline data={r.trend || []} labels={r.trendLabels || []} width={120} height={32} /> },
  { header: '广告投放比', align: 'center', width: 140, accessor: (r) => r.adDeliveryRate, render: (r) => <RateBar rate={r.adDeliveryRate} /> },
  { header: '广告贡献比例', align: 'center', width: 140, accessor: (r) => r.adContributionRate, render: (r) => <RateBar rate={r.adContributionRate} /> },
  { header: '广告加载率', align: 'center', width: 140, accessor: (r) => r.adLoadingRate, render: (r) => <RateBar rate={r.adLoadingRate} /> },
];

/** TapApp首页找游戏曝光游戏明细列表列配置（在游戏名称后加标签列，tag1/tag2/tag3 分级突出显示） */
export const TAPAPP_AD_GAME_LIST_COLUMNS = [
  { header: 'APPID', width: '5%', accessor: (r) => r.appId, render: (r) => <span className="text-muted small">{r.appId}</span> },
  { header: '游戏名称', width: '10%', accessor: (r) => r.appName, render: (r) => {
    const dt = r.distributionType;
    const letter = dt === 1 ? 'C' : dt === 2 ? 'M' : null;
    const letterColor = dt === 1 ? '#9B93A8' : '#9CAF9F';
    return (
      <span className="d-inline-flex align-items-center gap-1" title={r.appName || undefined} style={{ whiteSpace: 'nowrap' }}>
        {letter && (
          <span className="rounded-circle d-inline-flex align-items-center justify-content-center fw-bold" style={{ backgroundColor: letterColor, color: '#fff', width: 16, height: 16, fontSize: 10, flexShrink: 0 }}>{letter}</span>
        )}
        <span className="fw-semibold">{truncateName(r.appName)}</span>
      </span>
    );
  } },
  {
    header: '标签',
    width: '16%',
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
    header: '投放排名',
    width: '6%',
    help: [
      { color: '#8A8F6B', text: '本日排名' },
      { color: '#C9B79C', text: '本周排名' },
      { color: '#B08B8B', text: '本月排名' },
      { color: '#6E6E6E', text: '无排名' },
    ],
    render: (r) => {
      const items = [
        { value: r.dailyRank, color: '#8A8F6B' },
        { value: r.weeklyRank, color: '#C9B79C' },
        { value: r.monthlyRank, color: '#B08B8B' },
      ];
      return (
        <div className="d-flex flex-wrap gap-1">
          {items.map((it, idx) => {
            const hit = it.value != null;
            return (
              <span key={idx} className="badge" style={{ backgroundColor: hit ? it.color : '#6E6E6E', color: '#fff' }}>
                {hit ? it.value : '-'}
              </span>
            );
          })}
        </div>
      );
    },
  },
  { header: '曝光次数', align: 'center', width: '8%', help: '指命中一次系统采集，则为一次曝光', accessor: (r) => r.showCnt, render: (r) => <PlatformBar ios={r.iosShowCnt} android={r.androidShowCnt} total={r.showCnt} /> },
  { header: '广告投放次数', align: 'center', width: '8%', help: '指命中一次系统采集，且本次命中的素材中带有AD标志，则为一次广告投放', accessor: (r) => r.adCnt, render: (r) => <PlatformBar ios={r.iosAdCnt} android={r.androidAdCnt} total={r.adCnt} /> },
  { header: '投放趋势', align: 'center', width: '20%', help: '为最近7天内每日投放的趋势，x轴为每日时间，y轴为每日的广告投放次数', render: (r) => <Sparkline data={r.trend || []} labels={r.trendLabels || []} width={120} height={32} /> },
  { header: '广告投放比', align: 'center', width: '8%', help: '广告投放比=广告投放次数/曝光次数', accessor: (r) => r.adDeliveryRate, render: (r) => <RateBar rate={r.adDeliveryRate} /> },
  { header: '广告贡献比例', align: 'center', width: '8%', help: '广告贡献比例=广告投放次数/总广告投放数', accessor: (r) => r.adContributionRate, render: (r) => <RateBar rate={r.adContributionRate} /> },
  { header: '广告加载率', align: 'center', width: '8%', help: '广告加载率=广告投放次数/总曝光次数', accessor: (r) => r.adLoadingRate, render: (r) => <RateBar rate={r.adLoadingRate} /> },
];

/** TapApp搜索页广告来源分类 */
export const SEARCH_SOURCES = [
  { key: 'discovery', label: '搜索发现' },
  { key: 'hot_search', label: '热搜' },
  { key: 'hot_spot', label: '热点' },
];

/** TapApp搜索页关键词统计表格列配置 */
export const TAPAPP_SEARCH_KEYWORD_COLUMNS = [
  { header: '关键字', accessor: (r) => r.keyword, render: (r) => <span className="fw-semibold">{r.keyword}</span> },
  {
    header: '投放排名',
    render: (r) => {
      const items = [
        { value: r.dailyRank, color: '#8A8F6B' },
        { value: r.weeklyRank, color: '#C9B79C' },
        { value: r.monthlyRank, color: '#B08B8B' },
      ];
      return (
        <div className="d-flex flex-wrap gap-1">
          {items.map((it, idx) => {
            const hit = it.value != null;
            return (
              <span key={idx} className="badge" style={{ backgroundColor: hit ? it.color : '#6E6E6E', color: '#fff' }}>
                {hit ? it.value : '-'}
              </span>
            );
          })}
        </div>
      );
    },
  },
  { header: '曝光次数', align: 'center', width: 140, accessor: (r) => r.showCnt, render: (r) => <PlatformBar ios={r.iosShowCnt} android={r.androidShowCnt} total={r.showCnt} /> },
  { header: '广告投放次数', align: 'center', width: 140, accessor: (r) => r.adCnt, render: (r) => <PlatformBar ios={r.iosAdCnt} android={r.androidAdCnt} total={r.adCnt} /> },
  { header: '投放趋势', align: 'center', render: (r) => <Sparkline data={r.trend || []} labels={r.trendLabels || []} width={120} height={32} /> },
  { header: '广告投放比', align: 'center', width: 140, accessor: (r) => r.adDeliveryRate, render: (r) => <RateBar rate={r.adDeliveryRate} /> },
  { header: '广告贡献比', align: 'center', width: 140, accessor: (r) => r.adContributionRate, render: (r) => <RateBar rate={r.adContributionRate} /> },
  { header: '广告加载率', align: 'center', width: 140, accessor: (r) => r.adLoadingRate, render: (r) => <RateBar rate={r.adLoadingRate} /> },
];
