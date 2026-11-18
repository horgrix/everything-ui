/**
 * TapTap广告统计
 * - 【广告大盘】日趋势：本周 vs 上周（x=星期几，本周实线加粗 / 上周虚线）
 * - 其余指标待接入（数据表与口径确认后替换占位）
 */
import { useMemo } from 'react';
import SparkStackBar from '../../components/common/SparkStackBar';
import Sparkline from '../../components/common/Sparkline';
import {
  buildAdGameWeeklyTopSql,
  buildAdAggrGameDailyTrendSql,
  buildAdGameChannelTrendSql,
  buildAdOverviewWeekSql,
  buildAdOverviewDailyTrendSql,
  buildAdRankWeekSql,
  buildAdRankDerivedWeekSql,
  buildAdTodaySummarySql,
  buildAdDaySummarySql,
  lastWeekRankKey,
  thisWeekWhere,
} from './sql';
import {
  transformAdGameWeeklyTop,
  transformAdGameChannelTrend,
  transformAdGameDailyTrend,
  transformAdOverviewWeek,
  transformAdOverviewDailyTrend,
  transformAdRankWeek,
  transformAdRankDerivedWeek,
  transformAdExposureToday,
  transformAdExposureHistory,
} from './transforms';
import { useSqlQuery, useSqlQueryV09 } from './queries';
import DataTable from './components/DataTable';
import AdKpiRow from './components/AdKpiRow';
import CurrentHourAdTips from './components/CurrentHourAdTips';
import GameChannelTrendTip from './components/GameChannelTrendTip';
import PcAdWeeklyDetail from './components/PcAdWeeklyDetail';
import TapAppLandingAdWeeklyDetail from './components/TapAppLandingAdWeeklyDetail';
import TapAppKeywordAdWeeklyDetail from './components/TapAppKeywordAdWeeklyDetail';
import { APP_AD_TAG_COLORS, truncateName, PercentBar, GameIcon, taptapAppUrl, PC_GAME_TYPE_META } from './shared';

/** 平台配色（与占比图一致）：APP 橙 / PC 紫 / KW 品红 */
const PLATFORM_COLORS = { app: '#f08c00', pc: '#7209b7', kw: '#d6336c' };

/** 游戏明细表里的 spark 列：每列一条堆叠条，segments 依次为自左向右的堆叠段 */
const SPARK_COLUMNS = [
  {
    header: '商业AD',
    width: '7%',
    segs: [
      { label: 'APP商业广告', field: 'appAdViews', color: PLATFORM_COLORS.app },
      { label: 'PC商业广告', field: 'pcAdViews', color: PLATFORM_COLORS.pc },
      { label: '关键词商业广告', field: 'kwAdViews', color: PLATFORM_COLORS.kw },
    ],
  },
  {
    header: '资源互换',
    width: '7%',
    segs: [
      { label: 'APP资源互换', field: 'appPcebidViews', color: PLATFORM_COLORS.app },
      { label: 'PC资源互换', field: 'pcPcebidViews', color: PLATFORM_COLORS.pc },
      { label: '关键词资源互换', field: 'kwPcebidViews', color: PLATFORM_COLORS.kw },
    ],
  },
  {
    header: '总投放',
    width: '9%',
    segs: [
      { label: '商业AD', field: 'adViews', color: '#7A8B99' },
      { label: '资源互换AD', field: 'pcebidViews', color: '#B08B8B' },
    ],
  },
];

/** OneSearch 线索查询路由（站内相对路径，用 APPID 拼 q 参数） */
const ONESEARCH_REPORT_PATH = '/one-search/report';

/** 本周游戏明细 Top50 列配置 */
const GAME_TOP_COLUMNS = [
  {
    header: '游戏类型',
    align: 'center',
    width: '7%',
    help: 'distribution_type：0 = 商业游戏，1 = 独立小游戏，2 = Maker小游戏',
    accessor: (r) => PC_GAME_TYPE_META[r.distributionType]?.label ?? '',
    render: (r) => {
      const meta = PC_GAME_TYPE_META[r.distributionType];
      if (!meta) return <span className="text-muted">-</span>;
      return <span className="badge" style={{ backgroundColor: meta.color, color: '#fff', fontWeight: 500 }}>{meta.label}</span>;
    },
  },
  {
    header: 'APPID',
    width: '6%',
    accessor: (r) => r.appId,
    render: (r) =>
      r.appId === '-' ? (
        <span className="text-muted">-</span> // 汇总行不发链接
      ) : (
        <a
          href={taptapAppUrl(r.appId)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-decoration-none"
          style={{ color: '#4361ee' }}
          title={`在 TapTap 打开 ${r.appName || ''}（APPID ${r.appId}）`}
        >
          {r.appId}
        </a>
      ),
  },
  {
    header: '游戏名称',
    width: '11%',
    accessor: (r) => r.appName,
    render: (r) => (
      <span className="d-inline-flex align-items-center gap-2" title={r.appName || undefined} style={{ whiteSpace: 'nowrap' }}>
        {r.appId !== '-' && <GameIcon src={r.icon} size={20} alt={r.appName ? `${r.appName} 图标` : ''} />}
        <span className="fw-semibold">{truncateName(r.appName)}</span>
      </span>
    ),
  },
  {
    header: '标签',
    width: '14%',
    accessor: (r) => r.tags.join(' '),
    render: (r) => (
      <div className="d-flex flex-wrap gap-1">
        {r.tags.length === 0 && <span className="text-muted">-</span>}
        {r.tags.map((tag, i) => (
          <span key={`${tag}-${i}`} className="badge" style={{ backgroundColor: APP_AD_TAG_COLORS[`tag${i + 1}`], color: '#fff' }}>{tag}</span>
        ))}
      </div>
    ),
  },
  {
    header: '上周排名',
    align: 'center',
    width: '5%',
    accessor: (r) => r.lastWeekRank ?? null,
    help: '上周（上一自然周）投放排名：优先取 dws_taptap_ad_rank_v4_daily 的 weekly 快照；该周快照未入库时，按上周总投放倒序推算。app_id 命中显示名次，否则「未上榜」',
    render: (r) => {
      if (r.appId === '-') return <span className="text-muted">-</span>; // 汇总行
      if (r.lastWeekRank == null) return <span className="text-muted">未上榜</span>;
      const cls = r.lastWeekRank === 1 ? 'bg-warning text-dark' : r.lastWeekRank === 2 ? 'bg-secondary' : r.lastWeekRank === 3 ? 'bg-danger' : 'bg-light text-secondary border';
      return <span className={`badge ${cls}`}>{r.lastWeekRank}</span>;
    },
  },
  ...SPARK_COLUMNS.map((col) => ({
    header: col.header,
    align: 'center',
    width: col.width,
    help: col.segs.map((seg) => ({ color: seg.color, text: seg.label })),
    render: (r) => (
      <SparkStackBar segments={col.segs.map((seg) => ({ label: seg.label, value: r[seg.field], color: seg.color }))} />
    ),
  })),
  {
    header: '本周趋势',
    align: 'center',
    width: '10%',
    help: 'y=每日总投放（商业AD + 资源互换AD），x=周几；本周实线加粗，上周虚线对比',
    render: (r) => (
      <Sparkline data={r.trend} prevData={r.prevTrend} labels={r.trendLabels} currentLabel="本周" prevLabel="上周" width={100} height={32} />
    ),
  },
  {
    header: '详细趋势',
    align: 'center',
    width: '5%',
    help: '本周三渠道每日广告数折线：APP首页(app_ad_views+app_pcebid_views) / PC首页(pc_ad_views+pc_pcebid_views) / APP搜索关键词(kw_ad_views+kw_pcebid_views)',
    render: (r) => (r.channelTrend ? <GameChannelTrendTip appName={r.appName} trend={r.channelTrend} labels={WEEKDAYS} /> : <span className="text-muted">-</span>),
  },
  {
    header: '广告贡献度',
    align: 'center',
    width: '8%',
    help: '广告贡献度 = 本游戏总投放 / 全站本周总投放（汇总行 total_push，来自 dws_taptap_ad_overview_v5_daily）',
    render: (r) => <PercentBar value={r.share} color="#8FA3B0" />,
  },
  {
    // 与「下载Top25明细」同款跳转：新窗口打开 OneSearch 报告页
    header: 'OneSearch',
    align: 'center',
    width: '8%',
    help: '在 OneSearch 中查看该游戏的下载 / 在线 / 投放线索（新窗口打开报告页）',
    render: (r) =>
      r.appId === '-' ? (
        <span className="text-muted">-</span>
      ) : (
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
];

/** 周几（与 x 轴数值 0~6 对应） */
const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/**
 * 大盘指标说明（资源位 / 采集频率 / 命中含义）
 * 展示在【广告大盘】日趋势之上，说明曝光与广告数是怎么来的。
 */
function AdMetricHint() {
  const PLATFORM_TAGS = [
    { platform: 'IOS & Android', items: ['首页推荐', '搜索发现', '热搜', '热点'] },
    { platform: 'PC', items: ['每日发现', 'Top橱窗'] },
  ];

  const Row = ({ label, children }) => (
    <div className="d-flex flex-wrap gap-2" style={{ lineHeight: 1.9 }}>
      <span style={{ minWidth: 72, flexShrink: 0, color: '#495057', fontWeight: 600 }}>
        {label}
      </span>
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        {children}
      </div>
    </div>
  );

  return (
    <div
      className="d-flex gap-2 mb-4 px-3 py-2 rounded-3"
      style={{ backgroundColor: '#FAFBFC', border: '1px solid #EDF0F2' }}
    >
      <i className="bi bi-info-circle" style={{ fontSize: 15, lineHeight: '30px', color: '#A7B0B8' }}></i>
      <div className="small text-body flex-grow-1" style={{ minWidth: 0 }}>
        <Row label="资源位">
          <div className="d-flex flex-column" style={{ gap: 2 }}>
            {PLATFORM_TAGS.map((group) => (
              <div key={group.platform} className="d-flex flex-wrap align-items-center" style={{ gap: '4px 6px' }}>
                <span style={{ minWidth: 92, color: '#3B4750', fontWeight: 500 }}>{group.platform}</span>
                {group.items.map((item) => (
                  <span
                    key={item}
                    className="badge fw-normal"
                    style={{ backgroundColor: '#F2F5F7', color: '#5C6873', fontSize: 11, padding: '3px 8px' }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </Row>
        <Row label="采集频率">
          <span>1 小时 1 次</span>
        </Row>
        <Row label="命中的含义">
          <span>该小时广告出现在资源位；所以每个资源位每天最大值为 24</span>
        </Row>
      </div>
    </div>
  );
}

export default function TapTapAdStats() {
  // KPI：今日曝光（SQLite 当日累计）+ 昨日 / 上周同日（MySQL v09 日表）
  const todayExposureQuery = useSqlQuery(
    'taptap-ad-today-exposure',
    buildAdTodaySummarySql,
    [],
    transformAdExposureToday,
    { enabled: true, staleTime: 60 * 1000 },
  );
  const historyExposureQuery = useSqlQueryV09(
    'taptap-ad-history-exposure',
    buildAdDaySummarySql,
    [],
    transformAdExposureHistory,
    { enabled: true, staleTime: 5 * 60 * 1000 },
  );

  const gameTopQuery = useSqlQuery(
    'taptap-ad-game-weekly-top',
    buildAdGameWeeklyTopSql,
    [],
    transformAdGameWeeklyTop,
    { enabled: true },
  );

  const gameTrendQuery = useSqlQuery(
    'taptap-ad-game-daily-trend',
    buildAdAggrGameDailyTrendSql,
    [],
    transformAdGameDailyTrend,
    { enabled: true },
  );

  // 详细趋势：本周每日三渠道广告数（APP首页 / PC首页 / APP搜索关键词）
  const gameChannelTrendQuery = useSqlQuery(
    'taptap-ad-game-channel-trend',
    buildAdGameChannelTrendSql,
    [],
    transformAdGameChannelTrend,
    { enabled: true },
  );

  const overviewWeekQuery = useSqlQuery(
    'taptap-ad-overview-week',
    buildAdOverviewWeekSql,
    [],
    transformAdOverviewWeek,
    { enabled: true },
  );
  const overviewTrendQuery = useSqlQuery(
    'taptap-ad-overview-daily-trend',
    buildAdOverviewDailyTrendSql,
    [],
    transformAdOverviewDailyTrend,
    { enabled: true },
  );

  const rankWeekQuery = useSqlQuery(
    'taptap-ad-rank-week',
    buildAdRankWeekSql,
    [],
    transformAdRankWeek,
    { enabled: true },
  );
  // 官方上周快照为空时，用明细表现算上周排名兜底
  const rankDerivedQuery = useSqlQuery(
    'taptap-ad-rank-week-derived',
    buildAdRankDerivedWeekSql,
    [],
    transformAdRankDerivedWeek,
    { enabled: rankWeekQuery.isSuccess && !rankWeekQuery.data?.count },
  );

  const gameRows = useMemo(() => {
    const list = gameTopQuery.data || [];
    const trend = gameTrendQuery.data;
    const labels = trend?.labels || [];
    const overviewPush = overviewWeekQuery.data?.totalPush || 0;
    const rank = rankWeekQuery.data?.count ? rankWeekQuery.data : rankDerivedQuery.data;
    const channelByApp = gameChannelTrendQuery.data?.byApp || {};
    return list.map((r) => ({
      ...r,
      trend: trend?.thisWeek?.[r.appId] || [],
      prevTrend: trend?.lastWeek?.[r.appId] || [],
      trendLabels: labels,
      channelTrend: channelByApp[r.appId] || null,
      // 广告贡献度 = 本游戏总投放 / 全站本周总投放（汇总行）
      share: overviewPush > 0 ? (r.totalPush / overviewPush) * 100 : null,
      lastWeekRank: rank?.byAppId?.[r.appId] ?? null,
    }));
  }, [gameTopQuery.data, gameTrendQuery.data, gameChannelTrendQuery.data, overviewWeekQuery.data, rankWeekQuery.data, rankDerivedQuery.data]);

  /** 汇总行：全站本周合计（overview 表），趋势同样取全站每日总投放 */
  const overviewTotalRow = useMemo(() => {
    const week = overviewWeekQuery.data;
    if (!week) return null;
    const trend = overviewTrendQuery.data;
    return {
      ...week,
      trend: trend?.thisWeek || [],
      prevTrend: trend?.lastWeek || [],
      trendLabels: trend?.labels || [],
      share: 100,
      lastWeekRank: null,
    };
  }, [overviewWeekQuery.data, overviewTrendQuery.data]);

  return (
    <>
      {/* 指标说明：资源位 / 采集频率 / 命中含义 */}
      <AdMetricHint />

      <AdKpiRow
        today={todayExposureQuery.data}
        history={historyExposureQuery.data}
        loading={todayExposureQuery.isLoading || historyExposureQuery.isLoading}
      />

      {/* 第二行：本周游戏明细 Top50 */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-0">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div className="fw-semibold">【广告大盘】本周游戏明细 — Top50</div>
            {/* 本周明细入口标签：悬停看各渠道广告明细 */}
            <div className="d-flex align-items-center flex-wrap" style={{ gap: '1rem' }}>
              <CurrentHourAdTips />
              <PcAdWeeklyDetail />
              <TapAppLandingAdWeeklyDetail />
              <TapAppKeywordAdWeeklyDetail />
            </div>
          </div>
          <div className="d-flex align-items-center flex-wrap gap-2 mt-1">
            <span className="text-muted small">
              按「总投放」倒序取前 50；总投放 = 商业AD(ad_views) + 资源互换AD(pcebid_views)
            </span>
            <span className="text-muted small">数据范围：本周（{thisWeekWhere(0)} 起）</span>
            <span className="text-muted small">
              上周排名周：{lastWeekRankKey()}
              {rankWeekQuery.data?.count
                ? '（官方 weekly 快照）'
                : rankDerivedQuery.data?.count
                  ? '（官方快照未入库，按明细表上周总投放推算）'
                  : ''}
            </span>
          </div>
        </div>
        {gameTopQuery.isLoading && <div className="card-body text-muted small">加载中…</div>}
        {gameTopQuery.error && (
          <div className="card-body text-danger small">
            <i className="bi bi-exclamation-triangle me-1"></i>
            {gameTopQuery.error.message}
          </div>
        )}
        {!gameTopQuery.isLoading && !gameTopQuery.error && (
          <DataTable rows={gameRows} columns={GAME_TOP_COLUMNS} pageSize={10} totalRow={overviewTotalRow} />
        )}
      </div>

    </>
  );
}
