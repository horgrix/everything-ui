import { Link, useSearchParams } from 'react-router-dom';
import DetailSection from './DetailSection';
import { Metric, GrowthPill } from './metrics';
import { formatNumber } from '../../utils/formatters';
import { GameIcon, APP_AD_TAG_COLORS, PC_GAME_TYPE_META, taptapAppUrl, truncateName } from '../TapTapReport/shared';
import {
  useWeeklyReport,
  usePeriodicAd,
  useAdChannelWeek,
  useAdDistWeek,
  useAdTagWeek,
  useAdPeriodicRank,
  useAdAppChannelWeek,
  usePeriodicDownload,
  usePeriodicOnline,
  useOnlineListWeekly,
  useOnlineDistWeekly,
  onlineDetailItems,
  ONLINE_LISTS,
  useDownloadDistWeekly,
  useDownloadPeriodicRank,
  useDownloadAppChannelWeek,
  downloadDetailItems,
  adDetailItems,
  DIST_TYPES,
} from './data';

/** 空态面板 */
function Panel({ children }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #EDF0F2',
        borderRadius: 16,
        boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
        padding: '56px 20px',
        textAlign: 'center',
        color: '#A7B0B8',
        fontSize: 12.5,
      }}
    >
      {children}
    </div>
  );
}

/** 指标行：一行 N 个指标（带环比胶囊） */
function MetricRow({ items, hideGrowth = false }) {
  // 5 个指标在 xl 下一行排满；3 个一行 3 个；其余一行 4 个。小屏统一两列
  const colClass =
    items.length >= 5
      ? 'col-12 col-sm-6 col-xl'
      : items.length === 3
        ? 'col-12 col-sm-6 col-xl-4'
        : 'col-12 col-sm-6 col-xl-3';
  return (
    <div className="row g-0" style={{ rowGap: 16 }}>
      {items.map((it) => (
        <Metric key={it.label} {...it} hideGrowth={hideGrowth} colClass={colClass} />
      ))}
    </div>
  );
}

/** 占比表格：首列 25%，其余各 15%（游戏类型 / Tag 分类共用） */
const AD_BREAKDOWN_COLS = [
  { key: 'appCnt', label: '有投放游戏数' },
  { key: 'totalViews', label: '总投放数' },
  { key: 'appHome', label: 'APP首页投放数' },
  { key: 'kwHome', label: 'APP搜索页关键词投放数' },
  { key: 'pcHome', label: 'PC首页投放数' },
];

const ONLINE_BREAKDOWN_COLS = [
  { key: 'gameCnt', label: '统计的游戏数' },
  { key: 'peakOnline', label: '最大在线人数' },
  { key: 'avgOnline', label: '平均在线人数' },
];

const DOWNLOAD_BREAKDOWN_COLS = [
  { key: 'gameCnt', label: '统计游戏数' },
  { key: 'downloadTotal', label: '总下载数' },
  { key: 'downloadApp', label: 'APP下载数' },
  { key: 'downloadPc', label: 'PC下载数' },
];

function BreakdownTable({ title, hint, firstColLabel, rows, hideGrowth = false, cols = AD_BREAKDOWN_COLS }) {
  const COL_TYPE = '25%';
  const COL_VAL = cols.length === 5 ? '15%' : `${75 / cols.length}%`;

  return (
    <div style={{ marginTop: 20 }}>
      <div className="d-flex align-items-baseline justify-content-between flex-wrap" style={{ gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.6, color: '#5C6873' }}>{title}</span>
        {hint && <span style={{ fontSize: 11, color: '#A7B0B8' }}>{hint}</span>}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 720 }}>
          <div className="d-flex" style={{ fontSize: 10.5, color: '#A7B0B8', paddingBottom: 6, borderBottom: '1px solid #F1F4F6' }}>
            <span style={{ flex: `0 0 ${COL_TYPE}`, minWidth: 0 }}>{firstColLabel}</span>
            {cols.map((c) => (
              <span key={c.key} style={{ flex: `0 0 ${COL_VAL}`, textAlign: 'right', whiteSpace: 'nowrap' }}>
                {c.label}
              </span>
            ))}
          </div>

          {rows.map((row) => (
            <div
              key={row.key}
              className="d-flex align-items-center"
              style={{ padding: '9px 0', borderBottom: '1px solid #F7F9FA' }}
            >
              <span className="d-inline-flex align-items-center" style={{ flex: `0 0 ${COL_TYPE}`, gap: 7, minWidth: 0 }}>
                <span
                  style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: row.color || '#A7B0B8', flex: '0 0 auto' }}
                ></span>
                <span
                  style={{ fontSize: 12, color: '#4B565F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={row.label}
                >
                  {row.label}
                </span>
              </span>
              {cols.map((c) => {
                const cur = row.cur ? (row.cur[c.key] ?? 0) : null;
                const prev = row.prev ? (row.prev[c.key] ?? 0) : null;
                const showGrowth = !hideGrowth && cur != null && !(cur === 0 && (prev == null || prev === 0));
                return (
                  <span
                    key={c.key}
                    className="d-inline-flex align-items-baseline justify-content-end"
                    style={{ flex: `0 0 ${COL_VAL}`, gap: 5, minWidth: 0, whiteSpace: 'nowrap' }}
                    title={prev == null ? undefined : `上期：${formatNumber(prev)}`}
                  >
                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                        color: cur == null ? '#C4CBD1' : '#1F272E',
                      }}
                    >
                      {cur == null ? '—' : formatNumber(cur)}
                    </span>
                    {showGrowth && <GrowthPill cur={cur} prev={prev} compact />}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 按游戏类型分类（distribution_type 0/1/2） */
function DistBreakdown({ distMap, prevMap, hideGrowth }) {
  const rows = DIST_TYPES.map((t) => ({
    key: String(t.value),
    label: t.label,
    color: t.color,
    // 该类型当周无投放时按 0 展示（整表查询失败才显示 —）
    cur: distMap ? distMap[t.value] || {} : null,
    prev: prevMap ? prevMap[t.value] || {} : null,
  }));
  return (
    <BreakdownTable
      title="按游戏类型分类"
      hint="0 = 商业游戏 · 1 = 创意工坊 · 2 = TapMaker"
      firstColLabel="游戏类型"
      rows={rows}
      hideGrowth={hideGrowth}
    />
  );
}

/** 投放 Top10：排名 / 游戏（icon+名称）/ 标签 / 类型 / 四类投放数 */
function AdRankTop10({ rows, chMap, chPrevMap, hideGrowth = false }) {
  // 列宽占比：5% / 20% / 25% / 10% / 10% / 10% / 10% / 10%
  const W = { rank: '5%', name: '20%', tags: '25%', type: '10%' };
  const cols = [
    { key: 'totalViews', label: '总投放数', w: '10%', strong: true },
    { key: 'appHome', label: 'APP首页投放数', w: '10%' },
    { key: 'kwHome', label: 'APP搜索页关键词投放数', w: '10%' },
    { key: 'pcHome', label: 'PC首页投放数', w: '10%' },
  ];
  const boxStyle = { borderBottom: '1px solid #F7F9FA' };
  const cellNumber = (v, strong) => (
    <span
      style={{
        fontSize: strong ? 14 : 13,
        fontWeight: strong ? 600 : 500,
        fontVariantNumeric: 'tabular-nums',
        color: v == null ? '#C4CBD1' : strong ? '#1F272E' : '#4B565F',
      }}
    >
      {v == null ? '—' : formatNumber(v)}
    </span>
  );

  return (
    <div style={{ marginTop: 20 }}>
      <div className="d-flex align-items-baseline justify-content-between flex-wrap" style={{ gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.6, color: '#5C6873' }}>投放 Top 10</span>
        <span style={{ fontSize: 11, color: '#A7B0B8' }}>按当周广告榜排名（含商业广告 + 资源互换）</span>
      </div>

      {!rows?.length ? (
        <div style={{ fontSize: 11.5, color: '#A7B0B8' }}>该周期暂无投放榜数据</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 860 }}>
            <div
              className="d-flex align-items-center"
              style={{ fontSize: 10.5, color: '#A7B0B8', paddingBottom: 6, borderBottom: '1px solid #F1F4F6' }}
            >
              <span style={{ flex: `0 0 ${W.rank}`, minWidth: 0 }}>排名</span>
              <span style={{ flex: `0 0 ${W.name}`, minWidth: 0 }}>游戏名称</span>
              <span style={{ flex: `0 0 ${W.tags}`, minWidth: 0 }}>标签</span>
              <span style={{ flex: `0 0 ${W.type}`, minWidth: 0 }}>游戏类型</span>
              {cols.map((c) => (
                <span key={c.key} style={{ flex: `0 0 ${c.w}`, textAlign: 'right', whiteSpace: 'nowrap', minWidth: 0 }}>
                  {c.label}
                </span>
              ))}
            </div>

            {rows.map((r) => {
              const typeMeta = PC_GAME_TYPE_META[r.distributionType];
              const rankTone =
                r.rank === 1
                  ? { background: 'rgba(191,174,142,0.22)', color: '#9A7F4E' }
                  : r.rank === 2
                    ? { background: 'rgba(122,139,153,0.18)', color: '#63727E' }
                    : r.rank === 3
                      ? { background: 'rgba(176,139,139,0.2)', color: '#A0554F' }
                      : { background: '#F5F7F9', color: '#8A959E' };
              return (
                <div key={`${r.appId}-${r.rank}`} className="d-flex align-items-center" style={{ ...boxStyle, padding: '9px 0' }}>
                  <span style={{ flex: `0 0 ${W.rank}`, minWidth: 0 }}>
                    <span
                      className="d-inline-flex align-items-center justify-content-center fw-bold"
                      style={{ ...rankTone, minWidth: 24, height: 22, padding: '0 6px', borderRadius: 8, fontSize: 11.5 }}
                    >
                      {r.rank ?? '-'}
                    </span>
                  </span>

                  <span className="d-inline-flex align-items-center" style={{ flex: `0 0 ${W.name}`, minWidth: 0, gap: 8 }}>
                    <GameIcon src={r.icon} size={20} alt={r.appName ? `${r.appName} 图标` : ''} />
                    <a
                      href={taptapAppUrl(r.appId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-decoration-none"
                      style={{ fontSize: 12, color: '#2F3A42', fontWeight: 500, whiteSpace: 'nowrap' }}
                      title={r.appName}
                    >
                      {truncateName(r.appName)}
                    </a>
                  </span>

                  <span className="d-flex flex-wrap" style={{ flex: `0 0 ${W.tags}`, gap: 4, minWidth: 0, paddingRight: 6 }}>
                    {r.tags.length === 0 && <span style={{ fontSize: 11, color: '#C4CBD1' }}>—</span>}
                    {r.tags.map((t, i) => (
                      <span
                        key={`${t}-${i}`}
                        className="badge"
                        style={{
                          backgroundColor: APP_AD_TAG_COLORS[`tag${i + 1}`],
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 500,
                          padding: '2px 5px',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </span>

                  <span style={{ flex: `0 0 ${W.type}`, minWidth: 0 }}>
                    {typeMeta ? (
                      <span
                        className="badge"
                        style={{ backgroundColor: typeMeta.color, color: '#fff', fontSize: 10, fontWeight: 500, padding: '2px 6px' }}
                      >
                        {typeMeta.label}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#C4CBD1' }}>—</span>
                    )}
                  </span>

                  {cols.map((c) => {
                    const id = String(r.appId);
                    // 总投放数取榜单表（含上周基数），三类渠道取当周/上周日表汇总
                    const cur = c.key === 'totalViews' ? r.totalViews : (chMap?.[id]?.[c.key] ?? 0);
                    const prev = c.key === 'totalViews' ? r.prevTotalViews : chPrevMap?.[id]?.[c.key] ?? null;
                    const showGrowth = !hideGrowth && cur != null && !(cur === 0 && (prev == null || prev === 0));
                    return (
                      <span
                        key={c.key}
                        className="d-inline-flex align-items-baseline justify-content-end"
                        style={{ flex: `0 0 ${c.w}`, gap: 5, whiteSpace: 'nowrap', minWidth: 0 }}
                        title={prev == null ? '上期未上榜' : `上期：${formatNumber(prev)}`}
                      >
                        {cellNumber(cur, c.strong)}
                        {showGrowth && <GrowthPill cur={cur} prev={prev} compact />}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** 增长 / 衰退 Top10：排名 / 游戏 / 标签 / 类型 / 总投放数 / Gap 投放数（5% / 30% / 30% / 10% / 12.5% / 12.5%） */
function ChangeTopTable({
  title,
  hint,
  rows,
  gapTone = 'up',
  valueKey = 'totalViews',
  gapKey = 'diffViews',
  valueLabel = '总投放数',
  gapLabel = 'Gap 投放数',
}) {
  const COLS = [
    { key: 'rank', label: '#', w: '5%', align: 'left' },
    { key: 'name', label: '游戏名称', w: '30%', align: 'left' },
    { key: 'tags', label: '标签', w: '30%', align: 'left' },
    { key: 'type', label: '类型', w: '10%', align: 'left' },
    { key: 'total', label: valueLabel, w: '12.5%', align: 'right' },
    { key: 'gap', label: gapLabel, w: '12.5%', align: 'right' },
  ];
  const gapColor = (v) => (v == null ? '#C4CBD1' : v > 0 ? '#4B7A54' : v < 0 ? '#A0554F' : '#63727E');

  return (
    <div className="h-100">
      <div className="d-flex align-items-baseline justify-content-between flex-wrap" style={{ gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.6, color: '#5C6873' }}>{title}</span>
        {hint && <span style={{ fontSize: 11, color: '#A7B0B8' }}>{hint}</span>}
      </div>

      {!rows?.length ? (
        <div style={{ fontSize: 11.5, color: '#A7B0B8' }}>该周期暂无数据</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 520 }}>
            <div className="d-flex" style={{ fontSize: 10.5, color: '#A7B0B8', paddingBottom: 6, borderBottom: '1px solid #F1F4F6' }}>
              {COLS.map((c) => (
                <span
                  key={c.key}
                  style={{ flex: `0 0 ${c.w}`, textAlign: c.align, whiteSpace: 'nowrap', minWidth: 0 }}
                >
                  {c.label}
                </span>
              ))}
            </div>

            {rows.map((r) => {
              const typeMeta = PC_GAME_TYPE_META[r.distributionType];
              return (
                <div
                  key={`${r.appId}-${r.rank}`}
                  className="d-flex align-items-center"
                  style={{ padding: '9px 0', borderBottom: '1px solid #F7F9FA' }}
                >
                  <span style={{ flex: `0 0 ${COLS[0].w}`, minWidth: 0 }}>
                    <span
                      className="d-inline-flex align-items-center justify-content-center"
                      style={{
                        minWidth: 22,
                        height: 20,
                        padding: '0 5px',
                        borderRadius: 7,
                        fontSize: 11,
                        fontWeight: 600,
                        background: r.rank <= 3 ? (gapTone === 'up' ? 'rgba(111,143,113,0.16)' : 'rgba(178,124,120,0.16)') : '#F5F7F9',
                        color: r.rank <= 3 ? (gapTone === 'up' ? '#4B7A54' : '#A0554F') : '#8A959E',
                      }}
                    >
                      {r.rank ?? '-'}
                    </span>
                  </span>

                  <span className="d-inline-flex align-items-center" style={{ flex: `0 0 ${COLS[1].w}`, minWidth: 0, gap: 8 }}>
                    <GameIcon src={r.icon} size={20} alt={r.appName ? `${r.appName} 图标` : ''} />
                    <a
                      href={taptapAppUrl(r.appId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-decoration-none"
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: '#2F3A42',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={r.appName}
                    >
                      {truncateName(r.appName)}
                    </a>
                  </span>

                  <span className="d-flex flex-wrap" style={{ flex: `0 0 ${COLS[2].w}`, gap: 4, minWidth: 0, paddingRight: 6 }}>
                    {r.tags.length === 0 && <span style={{ fontSize: 11, color: '#C4CBD1' }}>—</span>}
                    {r.tags.map((t, i) => (
                      <span
                        key={`${t}-${i}`}
                        className="badge"
                        style={{
                          backgroundColor: APP_AD_TAG_COLORS[`tag${i + 1}`],
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 500,
                          padding: '2px 5px',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </span>

                  <span style={{ flex: `0 0 ${COLS[3].w}`, minWidth: 0 }}>
                    {typeMeta ? (
                      <span
                        className="badge"
                        style={{ backgroundColor: typeMeta.color, color: '#fff', fontSize: 10, fontWeight: 500, padding: '2px 6px' }}
                      >
                        {typeMeta.label}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#C4CBD1' }}>—</span>
                    )}
                  </span>

                  <span
                    style={{
                      flex: `0 0 ${COLS[4].w}`,
                      textAlign: 'right',
                      fontSize: 13.5,
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                      color: r[valueKey] == null ? '#C4CBD1' : '#1F272E',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r[valueKey] == null ? '—' : formatNumber(r[valueKey])}
                  </span>

                  <span
                    style={{
                      flex: `0 0 ${COLS[5].w}`,
                      textAlign: 'right',
                      fontSize: 13,
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                      color: gapColor(r[gapKey]),
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r[gapKey] == null ? '—' : `${r[gapKey] > 0 ? '+' : ''}${formatNumber(r[gapKey])}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** 在线：按 list_type 分类（小游戏 / PC模拟器 / PC） */
function OnlineListBreakdown({ curMap, prevMap, hideGrowth }) {
  const rows = ONLINE_LISTS.map((t) => ({
    key: t.value,
    label: t.label,
    color: t.color,
    cur: curMap ? curMap[t.value] || {} : null,
    prev: prevMap ? prevMap[t.value] || {} : null,
  }));
  return (
    <BreakdownTable
      title="按 list_type 分类"
      hint="app_hot_creative = 小游戏 · pc_emulator_played = PC模拟器 · pc_played = PC"
      firstColLabel="类型"
      rows={rows}
      hideGrowth={hideGrowth}
      cols={ONLINE_BREAKDOWN_COLS}
    />
  );
}

/** 在线：按游戏类型分类（distribution_type 0/1/2） */
function OnlineDistBreakdown({ curMap, prevMap, hideGrowth }) {
  const rows = DIST_TYPES.map((t) => ({
    key: String(t.value),
    label: t.label,
    color: t.color,
    cur: curMap ? curMap[t.value] || {} : null,
    prev: prevMap ? prevMap[t.value] || {} : null,
  }));
  return (
    <BreakdownTable
      title="按游戏类型分类"
      hint="0 = 商业游戏 · 1 = 创意工坊 · 2 = TapMaker"
      firstColLabel="游戏类型"
      rows={rows}
      hideGrowth={hideGrowth}
      cols={ONLINE_BREAKDOWN_COLS}
    />
  );
}

/** 下载：按游戏类型分类（distribution_type 0/1/2） */
function DownloadDistBreakdown({ curMap, prevMap, hideGrowth }) {
  const rows = DIST_TYPES.map((t) => ({
    key: String(t.value),
    label: t.label,
    color: t.color,
    cur: curMap ? curMap[t.value] || {} : null,
    prev: prevMap ? prevMap[t.value] || {} : null,
  }));
  return (
    <BreakdownTable
      title="按游戏类型分类"
      hint="0 = 商业游戏 · 1 = 创意工坊 · 2 = TapMaker"
      firstColLabel="游戏类型"
      rows={rows}
      hideGrowth={hideGrowth}
      cols={DOWNLOAD_BREAKDOWN_COLS}
    />
  );
}

/** 下载 Top 20：排名 / 游戏 / 标签 / 类型 / 总下载数 / APP下载数 / PC下载数 */
function DownloadTop20({ rows, chMap, chPrevMap, hideGrowth = false }) {
  // 列宽占比：排名 5% / 游戏名 20% / 标签 25% / 类型 10% / 总下载 15% / APP 15% / PC 10%
  const W = { rank: '5%', name: '20%', tags: '25%', type: '10%' };
  const cols = [
    { key: 'downloadTotal', label: '总下载数', w: '15%', strong: true },
    { key: 'downloadApp', label: 'APP下载数', w: '15%' },
    { key: 'downloadPc', label: 'PC下载数', w: '10%' },
  ];

  return (
    <div style={{ marginTop: 20 }}>
      <div className="d-flex align-items-baseline justify-content-between flex-wrap" style={{ gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.6, color: '#5C6873' }}>下载 Top 20</span>
        <span style={{ fontSize: 11, color: '#A7B0B8' }}>按当周下载榜排名</span>
      </div>

      {!rows?.length ? (
        <div style={{ fontSize: 11.5, color: '#A7B0B8' }}>该周期暂无下载榜数据</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 720 }}>
            <div
              className="d-flex align-items-center"
              style={{ fontSize: 10.5, color: '#A7B0B8', paddingBottom: 6, borderBottom: '1px solid #F1F4F6' }}
            >
              <span style={{ flex: `0 0 ${W.rank}`, minWidth: 0 }}>排名</span>
              <span style={{ flex: `0 0 ${W.name}`, minWidth: 0 }}>游戏名称</span>
              <span style={{ flex: `0 0 ${W.tags}`, minWidth: 0 }}>标签</span>
              <span style={{ flex: `0 0 ${W.type}`, minWidth: 0 }}>游戏类型</span>
              {cols.map((c) => (
                <span key={c.key} style={{ flex: `0 0 ${c.w}`, textAlign: 'right', whiteSpace: 'nowrap', minWidth: 0 }}>
                  {c.label}
                </span>
              ))}
            </div>

            {rows.map((r) => {
              const typeMeta = PC_GAME_TYPE_META[r.distributionType];
              const rankTone =
                r.rank === 1
                  ? { background: 'rgba(191,174,142,0.22)', color: '#9A7F4E' }
                  : r.rank === 2
                    ? { background: 'rgba(122,139,153,0.18)', color: '#63727E' }
                    : r.rank === 3
                      ? { background: 'rgba(176,139,139,0.2)', color: '#A0554F' }
                      : { background: '#F5F7F9', color: '#8A959E' };

              return (
                <div key={`${r.appId}-${r.rank}`} className="d-flex align-items-center" style={{ padding: '9px 0', borderBottom: '1px solid #F7F9FA' }}>
                  <span style={{ flex: `0 0 ${W.rank}`, minWidth: 0 }}>
                    <span
                      className="d-inline-flex align-items-center justify-content-center fw-bold"
                      style={{ ...rankTone, minWidth: 24, height: 22, padding: '0 6px', borderRadius: 8, fontSize: 11.5 }}
                    >
                      {r.rank ?? '-'}
                    </span>
                  </span>

                  <span className="d-inline-flex align-items-center" style={{ flex: `0 0 ${W.name}`, minWidth: 0, gap: 8 }}>
                    <GameIcon src={r.icon} size={20} alt={r.appName ? `${r.appName} 图标` : ''} />
                    <a
                      href={taptapAppUrl(r.appId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-decoration-none"
                      style={{ fontSize: 12, color: '#2F3A42', fontWeight: 500, whiteSpace: 'nowrap' }}
                      title={r.appName}
                    >
                      {truncateName(r.appName)}
                    </a>
                  </span>

                  <span className="d-flex flex-wrap" style={{ flex: `0 0 ${W.tags}`, gap: 4, minWidth: 0, paddingRight: 6 }}>
                    {r.tags.length === 0 && <span style={{ fontSize: 11, color: '#C4CBD1' }}>—</span>}
                    {r.tags.map((t, i) => (
                      <span
                        key={`${t}-${i}`}
                        className="badge"
                        style={{
                          backgroundColor: APP_AD_TAG_COLORS[`tag${i + 1}`],
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 500,
                          padding: '2px 5px',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </span>

                  <span style={{ flex: `0 0 ${W.type}`, minWidth: 0 }}>
                    {typeMeta ? (
                      <span
                        className="badge"
                        style={{ backgroundColor: typeMeta.color, color: '#fff', fontSize: 10, fontWeight: 500, padding: '2px 6px' }}
                      >
                        {typeMeta.label}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#C4CBD1' }}>—</span>
                    )}
                  </span>

                  {cols.map((c) => {
                    const id = String(r.appId);
                    const cur = c.key === 'downloadTotal' ? r.downloadTotal : (chMap?.[id]?.[c.key] ?? 0);
                    const prev = c.key === 'downloadTotal' ? r.prevDownloadTotal : chPrevMap?.[id]?.[c.key] ?? null;
                    const showGrowth = !hideGrowth && cur != null && !(cur === 0 && (prev == null || prev === 0));
                    return (
                      <span
                        key={c.key}
                        className="d-inline-flex align-items-baseline justify-content-end"
                        style={{ flex: `0 0 ${c.w}`, gap: 5, whiteSpace: 'nowrap', minWidth: 0 }}
                        title={prev == null ? '上期未上榜' : `上期：${formatNumber(prev)}`}
                      >
                        <span
                          style={{
                            fontSize: c.strong ? 14 : 13,
                            fontWeight: c.strong ? 600 : 500,
                            fontVariantNumeric: 'tabular-nums',
                            color: cur == null ? '#C4CBD1' : c.strong ? '#1F272E' : '#4B565F',
                          }}
                        >
                          {cur == null ? '—' : formatNumber(cur)}
                        </span>
                        {showGrowth && <GrowthPill cur={cur} prev={prev} compact />}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** 按 Tag 分类（tag_1，按总投放数取 Top 10） */
function TagBreakdown({ curList, prevList, hideGrowth }) {
  const prevMap = {};
  (prevList || []).forEach((r) => {
    prevMap[r.tag] = r;
  });
  const rows = (curList || []).map((r, i) => ({
    key: `${r.tag}-${i}`,
    label: r.tag || '(空)',
    color: '#9B93A8',
    cur: r,
    prev: prevMap[r.tag] || null,
  }));

  if (!rows.length) {
    return (
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.6, color: '#5C6873', marginBottom: 8 }}>按 Tag 类型分类</div>
        <div style={{ fontSize: 11.5, color: '#A7B0B8' }}>该周期暂无 Tag 投放数据</div>
      </div>
    );
  }

  return (
    <BreakdownTable
      title="按 Tag 类型分类 · Top 10"
      hint="按总投放数取前 10，口径为主标签（tag_1）"
      firstColLabel="Tag"
      rows={rows}
      hideGrowth={hideGrowth}
    />
  );
}

/** 详情页四个可折叠分区 */
const SECTIONS = ['广告详情', '下载详情', '在线详情', '游戏详情'];

/**
 * 定期报告详情页（periodicReportDetailView）
 * 路由：/periodic-report/detail?week=2026-43
 * 展示该周期全部指标（含列表卡片未展示的补充明细）与环比，支持上一期 / 下一期切换。
 */
export default function PeriodicReportDetail() {
  const [params, setParams] = useSearchParams();
  const weekKey = params.get('week') || '';

  const weeklyQuery = useWeeklyReport();
  const adQuery = usePeriodicAd();
  const downloadQuery = usePeriodicDownload();
  const onlineQuery = usePeriodicOnline();
  // 排版需要活跃游戏数（广告/下载/在线）时，从 './data' 引入 useActiveStat + buildStatMap 即可
  const rows = weeklyQuery.data || [];

  const idx = rows.findIndex((r) => r.weekKey === weekKey);
  const row = idx >= 0 ? rows[idx] : null;
  // rows 按周倒序：idx+1 是上一期，idx-1 是下一期
  const prevRow = idx >= 0 ? rows[idx + 1] || null : null;
  const nextRow = idx > 0 ? rows[idx - 1] || null : null;

  // 广告详情：按 week_key 取本期 / 上期
  const adRows = adQuery.data || [];
  const adRow = row ? adRows.find((r) => r.weekKey === row.weekKey) || null : null;
  const adPrevRow = prevRow ? adRows.find((r) => r.weekKey === prevRow.weekKey) || null : null;

  // 分渠道投放数（按周期区间从日表汇总）
  const chCurQuery = useAdChannelWeek(row?.weekStart, row?.weekEnd);
  const chPrevQuery = useAdChannelWeek(prevRow?.weekStart, prevRow?.weekEnd);

  // 下载详情：按 week_key 取本期 / 上期
  const downloadCur = row ? downloadQuery.data?.[row.weekKey] || null : null;
  const downloadPrev = prevRow ? downloadQuery.data?.[prevRow.weekKey] || null : null;
  const onlineCur = row ? onlineQuery.data?.[row.weekKey] || null : null;
  const onlinePrev = prevRow ? onlineQuery.data?.[prevRow.weekKey] || null : null;
  const onlineListQuery = useOnlineListWeekly();
  const onlineListCur = row ? onlineListQuery.data?.[row.weekKey] || null : null;
  const onlineListPrev = prevRow ? onlineListQuery.data?.[prevRow.weekKey] || null : null;
  const onlineDistQuery = useOnlineDistWeekly();
  const onlineDistCur = row ? onlineDistQuery.data?.[row.weekKey] || null : null;
  const onlineDistPrev = prevRow ? onlineDistQuery.data?.[prevRow.weekKey] || null : null;

  const downloadDistQuery = useDownloadDistWeekly();
  const downloadDistCur = row ? downloadDistQuery.data?.[row.weekKey] || null : null;
  const downloadDistPrev = prevRow ? downloadDistQuery.data?.[prevRow.weekKey] || null : null;
  const downloadRankQuery = useDownloadPeriodicRank(row?.weekKey, 20);
  const downloadChQuery = useDownloadAppChannelWeek(row?.weekStart, row?.weekEnd);
  const downloadChPrevQuery = useDownloadAppChannelWeek(prevRow?.weekStart, prevRow?.weekEnd);
  const downloadGainQuery = useDownloadPeriodicRank(row?.weekKey, null, 'gain');
  const downloadLossQuery = useDownloadPeriodicRank(row?.weekKey, null, 'loss');
  const distQuery = useAdDistWeek(row?.weekStart, row?.weekEnd);
  const distPrevQuery = useAdDistWeek(prevRow?.weekStart, prevRow?.weekEnd);
  const tagQuery = useAdTagWeek(row?.weekStart, row?.weekEnd, 10);
  const tagPrevQuery = useAdTagWeek(prevRow?.weekStart, prevRow?.weekEnd);
  const rankQuery = useAdPeriodicRank(row?.weekKey, 10);
  // 增长 / 衰退榜：源表存在并列名次与占位行，这里按 Gap（diff_views）重排后取前 10
  const gainRankQuery = useAdPeriodicRank(row?.weekKey, null, 'gain');
  const lossRankQuery = useAdPeriodicRank(row?.weekKey, null, 'loss');
  const rankChQuery = useAdAppChannelWeek(row?.weekStart, row?.weekEnd);
  const rankChPrevQuery = useAdAppChannelWeek(prevRow?.weekStart, prevRow?.weekEnd);

  /** 按 Gap 排序取前 10，并重编号（过滤掉名称为 '-' 的占位行） */
  const pickChangeTop = (list, direction, gapKey = 'diffViews') =>
    (list || [])
      .filter((r) => r.appName && r.appName !== '-' && r[gapKey] != null)
      .sort((a, b) => (direction === 'loss' ? a[gapKey] - b[gapKey] : b[gapKey] - a[gapKey]))
      .slice(0, 10)
      .map((r, i) => ({ ...r, rank: i + 1 }));

  const today = new Date().toISOString().slice(0, 10);
  const inProgress = row?.weekEnd ? row.weekEnd >= today : false;
  const weekNo = row ? String(row.weekKey).split('-')[1] : '';
  const year = row ? String(row.weekStart || row.weekKey).slice(0, 4) : '';

  const goWeek = (key) => {
    const next = new URLSearchParams(params);
    next.set('week', key);
    setParams(next, { replace: true });
  };

  const backLink = (
    <Link
      to="/periodic-report"
      className="text-decoration-none"
      style={{ fontSize: 12.5, color: '#71808A' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = '#1F272E';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = '#71808A';
      }}
    >
      <i className="bi bi-arrow-left me-1" style={{ fontSize: 11 }}></i>
      返回定期报告
    </Link>
  );

  const navBtn = (target, icon, label, dir) =>
    target ? (
      <button
        type="button"
        onClick={() => goWeek(target.weekKey)}
        style={{
          border: '1px solid #E3E8EC',
          background: '#fff',
          color: '#3B4750',
          fontSize: 12,
          fontWeight: 500,
          padding: '6px 12px',
          borderRadius: 10,
          marginLeft: dir === 'next' ? 8 : 0,
        }}
        title={`${label}：第 ${Number(String(target.weekKey).split('-')[1])} 周`}
      >
        {dir === 'prev' && <i className="bi bi-chevron-left me-1" style={{ fontSize: 10 }}></i>}
        {label}
        {dir === 'next' && <i className="bi bi-chevron-right ms-1" style={{ fontSize: 10 }}></i>}
      </button>
    ) : (
      <button
        type="button"
        disabled
        style={{
          border: '1px solid #EDF0F2',
          background: '#F8FAFB',
          color: '#C1C9CF',
          fontSize: 12,
          fontWeight: 500,
          padding: '6px 12px',
          borderRadius: 10,
          marginLeft: dir === 'next' ? 8 : 0,
          cursor: 'not-allowed',
        }}
      >
        {dir === 'prev' && <i className="bi bi-chevron-left me-1" style={{ fontSize: 10 }}></i>}
        {label}
        {dir === 'next' && <i className="bi bi-chevron-right ms-1" style={{ fontSize: 10 }}></i>}
      </button>
    );

  return (
    <div className="container-fluid p-4" style={{ maxWidth: 1440, margin: '0 auto' }}>
      {backLink}

      {weeklyQuery.error ? (
        <div className="mt-3" style={{ ...PanelStyle(), color: '#A0554F' }}>
          <i className="bi bi-exclamation-triangle me-1"></i>
          数据加载失败：{weeklyQuery.error.message}
        </div>
      ) : weeklyQuery.isLoading ? (
        <div className="mt-3">
          <Panel>
            <i className="bi bi-hourglass-split d-block mb-2" style={{ fontSize: 26 }}></i>
            加载中…
          </Panel>
        </div>
      ) : !row ? (
        <div className="mt-3">
          <Panel>
            <i className="bi bi-inbox d-block mb-2" style={{ fontSize: 26 }}></i>
            未找到该周期的报告{weekKey ? `（${weekKey}）` : ''}
          </Panel>
        </div>
      ) : (
        <>
          {/* 标题区 */}
          <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mt-2">
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.4, color: '#A7B0B8' }}>
                {year} · W{weekNo}
              </div>
              <div className="d-flex align-items-center flex-wrap" style={{ gap: 10, marginTop: 4 }}>
                <h1 style={{ fontSize: 26, fontWeight: 650, letterSpacing: -0.3, color: '#1B2228', margin: 0 }}>
                  第 {Number(weekNo)} 周报告详情
                </h1>
                {inProgress && (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      letterSpacing: 0.3,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: 'rgba(191,174,142,0.18)',
                      color: '#9A7F4E',
                    }}
                  >
                    进行中
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: '#8A959E', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
                统计区间 {row.weekStart} ~ {row.weekEnd}
                {row.updatedAt && <span className="ms-2" style={{ color: '#A7B0B8' }}>· 数据更新于 {String(row.updatedAt).replace('T', ' ').slice(0, 16)}</span>}
              </div>
            </div>
            <div className="d-flex align-items-center">
              {navBtn(prevRow, 'prev', '上一期', 'prev')}
              {navBtn(nextRow, 'next', '下一期', 'next')}
            </div>
          </div>

          {/* 内容区：四块可折叠分区，内容各自排版 */}
          <div className="d-flex flex-column" style={{ gap: 16, marginTop: 18 }}>
            <DetailSection title="广告详情">
              <MetricRow
                items={adDetailItems(adRow, adPrevRow, chCurQuery.data, chPrevQuery.data)}
                hideGrowth={inProgress}
              />
              <DistBreakdown distMap={distQuery.data} prevMap={distPrevQuery.data} hideGrowth={inProgress} />
              <TagBreakdown curList={tagQuery.data} prevList={tagPrevQuery.data} hideGrowth={inProgress} />
              <AdRankTop10
                rows={rankQuery.data}
                chMap={rankChQuery.data}
                chPrevMap={rankChPrevQuery.data}
                hideGrowth={inProgress}
              />

              {/* 增长 / 衰退 Top10 并排各占 50% */}
              <div className="row g-3" style={{ marginTop: 20 }}>
                <div className="col-12 col-xl-6">
                  <ChangeTopTable
                    title="增长 Top 10"
                    hint="按周增量（Gap）倒序"
                    rows={pickChangeTop(gainRankQuery.data, 'gain')}
                    gapTone="up"
                  />
                </div>
                <div className="col-12 col-xl-6">
                  <ChangeTopTable
                    title="衰退 Top 10"
                    hint="按周降幅（Gap）倒序"
                    rows={pickChangeTop(lossRankQuery.data, 'loss')}
                    gapTone="down"
                  />
                </div>
              </div>
            </DetailSection>
            <DetailSection title="下载详情">
              <MetricRow items={downloadDetailItems(downloadCur, downloadPrev)} hideGrowth={inProgress} />
              <DownloadDistBreakdown curMap={downloadDistCur} prevMap={downloadDistPrev} hideGrowth={inProgress} />
              <DownloadTop20
                rows={downloadRankQuery.data}
                chMap={downloadChQuery.data}
                chPrevMap={downloadChPrevQuery.data}
                hideGrowth={inProgress}
              />

              {/* 增量 / 衰退 Top10 并排各占 50% */}
              <div className="row g-3" style={{ marginTop: 20 }}>
                <div className="col-12 col-xl-6">
                  <ChangeTopTable
                    title="增量 Top 10"
                    hint="按周增量（Gap）倒序"
                    rows={pickChangeTop(downloadGainQuery.data, 'gain', 'diffDownload')}
                    gapTone="up"
                    valueKey="downloadTotal"
                    gapKey="diffDownload"
                    valueLabel="总下载数"
                    gapLabel="Gap 下载数"
                  />
                </div>
                <div className="col-12 col-xl-6">
                  <ChangeTopTable
                    title="衰退 Top 10"
                    hint="按周降幅（Gap）倒序"
                    rows={pickChangeTop(downloadLossQuery.data, 'loss', 'diffDownload')}
                    gapTone="down"
                    valueKey="downloadTotal"
                    gapKey="diffDownload"
                    valueLabel="总下载数"
                    gapLabel="Gap 下载数"
                  />
                </div>
              </div>
            </DetailSection>
            <DetailSection title="在线详情">
              <MetricRow items={onlineDetailItems(onlineCur, onlinePrev)} hideGrowth={inProgress} />
              <OnlineListBreakdown curMap={onlineListCur} prevMap={onlineListPrev} hideGrowth={inProgress} />
              <OnlineDistBreakdown curMap={onlineDistCur} prevMap={onlineDistPrev} hideGrowth={inProgress} />
            </DetailSection>
            {SECTIONS.filter((t) => !['广告详情', '下载详情', '在线详情'].includes(t)).map((t) => (
              <DetailSection key={t} title={t} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** 失败面板的内联样式 */
function PanelStyle() {
  return {
    background: '#fff',
    border: '1px solid #EDF0F2',
    borderRadius: 16,
    boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
    padding: '18px 22px',
    fontSize: 12.5,
  };
}
