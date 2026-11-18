/**
 * TapTap广告统计
 * - 【广告大盘】日趋势：本周 vs 上周（x=星期几，本周实线加粗 / 上周虚线）
 * - 其余指标待接入（数据表与口径确认后替换占位）
 */
import { useMemo } from 'react';
import SparkStackBar from '../../components/common/SparkStackBar';
import { formatNumber } from '../../utils/formatters';
import {
  buildAdTodaySummarySql,
  buildAdTodayDetailSql,
  buildAdTodayHourlyTrendSql,
  buildAppTodayActionSql,
  buildAdDaySummarySql,
} from './sql';
import {
  transformAdGameWeeklyTop,
  transformAdExposureToday,
  transformAdTodayHourlyTrend,
  transformAppTodayAction,
  transformAdExposureHistory,
} from './transforms';
import { useSqlQuery, useSqlQueryV09 } from './queries';
import DataTable from './components/DataTable';
import AdKpiRow from './components/AdKpiRow';
import CurrentHourAdTips from './components/CurrentHourAdTips';
import GameChannelTrendTip from './components/GameChannelTrendTip';
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
/** 今日日期（YYYY-MM-DD），用于副标题展示 */
function formatDayLabel() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
    width: '16%',
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
    width: '18%',
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
    header: 'CPA',
    align: 'center',
    width: '7%',
    help: 'CPA = 今日总投放 ÷ 今日行动量；行动量优先取今日下载量，下载为 0 时改用今日预约数（dws_taptap_download_v2_hourly / dws_taptap_reserve_v2_hourly）',
    render: (r) => {
      if (r.appId === '-') return <span className="text-muted">-</span>;
      if (r.cpa == null) {
        return (
          <span className="text-muted" title="今日无下载也无预约，无法计算 CPA">—</span>
        );
      }
      return (
        <span
          title={`总投放 ${formatNumber(r.totalPush)} ÷ ${r.cpaBasis === 'reserve' ? '预约' : '下载'} ${formatNumber(r.cpaBase)} = ${r.cpa.toFixed(2)}`}
          style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
        >
          {r.cpa > 0 && r.cpa < 0.01 ? '<0.01' : r.cpa.toFixed(2)}
          {r.cpaBasis === 'reserve' && <span className="text-muted ms-1" style={{ fontSize: 10 }}>预约</span>}
        </span>
      );
    },
  },
  {
    header: '详细趋势',
    align: 'center',
    width: '6%',
    help: '今日逐小时三渠道广告命中数折线：APP首页 / PC首页 / APP搜索关键词（原始小时抓取表，api/data/sql）',
    render: (r) => (r.hourlyTrend ? <GameChannelTrendTip appName={r.appName} trend={r.hourlyTrend} labels={r.hourlyLabels} /> : <span className="text-muted">-</span>),
  },
  {
    header: '广告贡献度',
    align: 'center',
    width: '9%',
    help: '广告贡献度 = 本游戏今日总投放 / 全站今日总投放（按今日明细行合计）',
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

  // 今日广告曝光明细（SQLite 日表当日行，不设 TopN）
  const todayDetailQuery = useSqlQuery(
    'taptap-ad-today-detail',
    buildAdTodayDetailSql,
    [],
    transformAdGameWeeklyTop,
    { enabled: true, staleTime: 60 * 1000 },
  );
  // 详细趋势：今日逐小时三渠道广告命中数（SQLite 原始小时表）
  const todayHourlyTrendQuery = useSqlQuery(
    'taptap-ad-today-hourly-trend',
    buildAdTodayHourlyTrendSql,
    [],
    transformAdTodayHourlyTrend,
    { enabled: true, staleTime: 60 * 1000 },
  );
  // CPA 分母：今日下载量 / 预约数（SQLite 小时表当日聚合）
  const todayActionQuery = useSqlQuery(
    'taptap-ad-today-action',
    buildAppTodayActionSql,
    [],
    transformAppTodayAction,
    { enabled: true, staleTime: 60 * 1000 },
  );

  const gameRows = useMemo(() => {
    const list = todayDetailQuery.data || [];
    const hourly = todayHourlyTrendQuery.data;
    const hourlyByApp = hourly?.byApp || {};
    const hourlyLabels = hourly?.labels || [];
    const actionByApp = todayActionQuery.data || {};
    // 广告贡献度分母 = 今日全站总投放（按今日明细行合计）
    const totalPushAll = list.reduce((sum, r) => sum + (Number(r.totalPush) || 0), 0);
    return list.map((r) => {
      const action = actionByApp[r.appId] || { downloads: 0, reserves: 0 };
      const useReserve = !(action.downloads > 0);
      const base = useReserve ? action.reserves : action.downloads;
      return {
        ...r,
        hourlyTrend: hourlyByApp[r.appId] || null,
        hourlyLabels,
        cpaBase: base,
        cpaBasis: useReserve ? 'reserve' : 'download',
        // CPA = 总投放 ÷ 今日行动量（下载优先，无下载时用预约）
        cpa: base > 0 ? r.totalPush / base : null,
        share: totalPushAll > 0 ? (r.totalPush / totalPushAll) * 100 : null,
      };
    });
  }, [todayDetailQuery.data, todayHourlyTrendQuery.data, todayActionQuery.data]);

  /** 汇总行：今日全站合计（直接累加明细行） */
  const overviewTotalRow = useMemo(() => {
    if (!gameRows.length) return null;
    const sum = (key) => gameRows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
    return {
      appId: '-',
      appName: '合计',
      icon: '',
      distributionType: null,
      tags: [],
      appAdViews: sum('appAdViews'),
      pcAdViews: sum('pcAdViews'),
      kwAdViews: sum('kwAdViews'),
      adViews: sum('adViews'),
      appPcebidViews: sum('appPcebidViews'),
      pcPcebidViews: sum('pcPcebidViews'),
      kwPcebidViews: sum('kwPcebidViews'),
      pcebidViews: sum('pcebidViews'),
      totalPush: sum('totalPush'),
      cpaBase: sum('cpaBase'),
      cpaBasis: 'download',
      cpa: sum('cpaBase') > 0 ? sum('totalPush') / sum('cpaBase') : null,
      share: 100,
    };
  }, [gameRows]);

  return (
    <>
      {/* 指标说明：资源位 / 采集频率 / 命中含义 */}
      <AdMetricHint />

      <AdKpiRow
        today={todayExposureQuery.data}
        history={historyExposureQuery.data}
        loading={todayExposureQuery.isLoading || historyExposureQuery.isLoading}
      />

      {/* 今日广告曝光明细（今日全部有曝光的 APP，不设 TopN） */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-0">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div className="fw-semibold">【广告大盘】今日广告曝光明细</div>
            {/* 明细入口标签：悬停看本时段各渠道广告 */}
            <div className="d-flex align-items-center flex-wrap" style={{ gap: '1rem' }}>
              <CurrentHourAdTips />
            </div>
          </div>
          <div className="d-flex align-items-center flex-wrap gap-2 mt-1">
            <span className="text-muted small">
              按「总投放」倒序，列出今日有曝光的全部 APP；总投放 = 商业AD(ad_views) + 资源互换AD(pcebid_views)
            </span>
            <span className="text-muted small">数据范围：今日（{formatDayLabel()}）· 共 {gameRows.length} 款</span>
            <span className="text-muted small">CPA = 总投放 ÷ 今日下载量（无下载时改用今日预约数）</span>
          </div>
        </div>
        {todayDetailQuery.isLoading && <div className="card-body text-muted small">加载中…</div>}
        {todayDetailQuery.error && (
          <div className="card-body text-danger small">
            <i className="bi bi-exclamation-triangle me-1"></i>
            {todayDetailQuery.error.message}
          </div>
        )}
        {!todayDetailQuery.isLoading && !todayDetailQuery.error && (
          <DataTable rows={gameRows} columns={GAME_TOP_COLUMNS} pageSize={10} totalRow={overviewTotalRow} />
        )}
      </div>

    </>
  );
}
