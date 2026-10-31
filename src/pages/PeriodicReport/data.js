import useChartData from '../../hooks/useChartData';
import { querySqlV09 } from '../../api/query';

/** 增长率：返回 { pct, label, tone } 或 null 表示无对比 */
export function growthOf(cur, prev) {
  if (cur == null || prev == null) return null;
  if (prev === 0) return cur === 0 ? { pct: 0, label: '0%', tone: 'flat' } : { pct: null, label: '新增', tone: 'up' };
  const pct = Math.round(((cur - prev) / prev) * 1000) / 10;
  return { pct, label: `${pct > 0 ? '+' : ''}${pct}%`, tone: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' };
}

/** 周报概览 SQL（列表页 / 详情页共用） */
const WEEKLY_SQL = `SELECT week_key, week_start, week_end,
        ad_total, ad_app, ad_kw, ad_pc,
        download_total, download_app, download_pc,
        download_dist_type_0, download_dist_type_1, download_dist_type_2,
        online_game_cnt, online_peak_players, online_peak_pc,
        online_peak_pc_emulator, online_peak_creative,
        torchlight_avg_online_players, torchlight_download_total,
        heartopia_avg_online_players, heartopia_download_total,
        updated_at
 FROM dws_periodic_report_overview_weekly
 ORDER BY week_key DESC`;

/** 广告周期汇总 SQL（全站口径 category_type='all'） */
const AD_PERIODIC_SQL = `SELECT crawled_at AS week_key, app_cnt, total_views, ad_views, pcebid_views,
        app_total, kw_total, pc_total
 FROM dws_taptap_ad_aggr_v6_periodic_report
 WHERE period_type = 'weekly' AND category_type = 'all'
 ORDER BY crawled_at DESC`;

/** 活跃游戏统计（weekly 快照，crawled_at 即 week_key） */
const ACTIVE_SQL = `SELECT crawled_at, ad_app_cnt, download_app_cnt, online_players_app_cnt
 FROM dws_taptap_active_game_stat
 WHERE period_type = 'weekly'`;

/** 周报数据行 → 驼峰字段 */
function transformWeekly(rows) {
  return (rows || []).map((r) => ({
    weekKey: r.week_key,
    weekStart: r.week_start,
    weekEnd: r.week_end,
    adTotal: r.ad_total == null ? null : Number(r.ad_total),
    adApp: r.ad_app == null ? null : Number(r.ad_app),
    adKw: r.ad_kw == null ? null : Number(r.ad_kw),
    adPc: r.ad_pc == null ? null : Number(r.ad_pc),
    downloadTotal: r.download_total == null ? null : Number(r.download_total),
    downloadApp: r.download_app == null ? null : Number(r.download_app),
    downloadPc: r.download_pc == null ? null : Number(r.download_pc),
    type0: r.download_dist_type_0 == null ? null : Number(r.download_dist_type_0),
    type1: r.download_dist_type_1 == null ? null : Number(r.download_dist_type_1),
    type2: r.download_dist_type_2 == null ? null : Number(r.download_dist_type_2),
    onlineGameCnt: r.online_game_cnt == null ? null : Number(r.online_game_cnt),
    onlinePeakPlayers: r.online_peak_players == null ? null : Number(r.online_peak_players),
    onlinePeakPc: r.online_peak_pc == null ? null : Number(r.online_peak_pc),
    onlinePeakPcEmulator: r.online_peak_pc_emulator == null ? null : Number(r.online_peak_pc_emulator),
    onlinePeakCreative: r.online_peak_creative == null ? null : Number(r.online_peak_creative),
    torchlightAvg: r.torchlight_avg_online_players == null ? null : Number(r.torchlight_avg_online_players),
    torchlightDownload: r.torchlight_download_total == null ? null : Number(r.torchlight_download_total),
    heartopiaAvg: r.heartopia_avg_online_players == null ? null : Number(r.heartopia_avg_online_players),
    heartopiaDownload: r.heartopia_download_total == null ? null : Number(r.heartopia_download_total),
    updatedAt: r.updated_at,
  }));
}

/** 周报概览查询（列表页 / 详情页共用同一缓存的 queryKey） */
export function useWeeklyReport() {
  return useChartData('periodic-report-weekly', () => querySqlV09(WEEKLY_SQL), {}, {
    enabled: true,
    staleTime: 10 * 60 * 1000,
    transform: transformWeekly,
  });
}

/** 广告周期汇总查询（广告详情分区用） */
export function usePeriodicAd() {
  return useChartData('periodic-report-ad-weekly', () => querySqlV09(AD_PERIODIC_SQL), {}, {
    enabled: true,
    staleTime: 10 * 60 * 1000,
    transform: (rows) =>
      (rows || []).map((r) => ({
        weekKey: r.week_key,
        appCnt: r.app_cnt == null ? null : Number(r.app_cnt),
        totalViews: r.total_views == null ? null : Number(r.total_views),
        adViews: r.ad_views == null ? null : Number(r.ad_views),
        pcebidViews: r.pcebid_views == null ? null : Number(r.pcebid_views),
        // v6 周期表自带三渠道合计，无需再回日表汇总
        appHome: r.app_total == null ? null : Number(r.app_total),
        kwHome: r.kw_total == null ? null : Number(r.kw_total),
        pcHome: r.pc_total == null ? null : Number(r.pc_total),
      })),
  });
}

/** 游戏类型维度：distribution_type → 名称 */
export const DIST_TYPES = [
  { value: 0, label: '商业游戏', color: '#7A8B99' },
  { value: 1, label: '创意工坊', color: '#9CAF9F' },
  { value: 2, label: 'TapMaker', color: '#BFAE8E' },
];

/**
 * 按游戏类型（distribution_type 0/1/2）汇总当周投放情况：
 * 有投放游戏数 / 总投放数 / APP首页 / APP搜索页关键词 / PC首页
 */
export function useAdDistWeek(start, end) {
  const enabled = !!(start && end);
  const sql = enabled
    ? `SELECT distribution_type AS dist,
              COUNT(DISTINCT CASE WHEN (COALESCE(ad_views, 0) + COALESCE(pcebid_views, 0)) > 0 THEN app_id END) AS app_cnt,
              SUM(COALESCE(ad_views, 0) + COALESCE(pcebid_views, 0)) AS total_views,
              SUM(COALESCE(app_ad_views, 0) + COALESCE(app_pcebid_views, 0)) AS app_home,
              SUM(COALESCE(kw_ad_views, 0) + COALESCE(kw_pcebid_views, 0)) AS kw_home,
              SUM(COALESCE(pc_ad_views, 0) + COALESCE(pc_pcebid_views, 0)) AS pc_home
       FROM dws_taptap_ad_aggr_v6_daily
       WHERE crawled_at >= '${start}' AND crawled_at <= '${end}'
         AND distribution_type IN (0, 1, 2)
       GROUP BY distribution_type`
    : '';
  return useChartData(
    `periodic-ad-dist-${start || 'none'}-${end || 'none'}`,
    (p) => querySqlV09(p.sql),
    { sql },
    {
      enabled,
      staleTime: 10 * 60 * 1000,
      transform: (rows) => {
        const map = {};
        (rows || []).forEach((r) => {
          if (r.dist == null) return;
          const n = (v) => (v == null ? null : Number(v));
          map[Number(r.dist)] = {
            appCnt: n(r.app_cnt),
            totalViews: n(r.total_views),
            appHome: n(r.app_home),
            kwHome: n(r.kw_home),
            pcHome: n(r.pc_home),
          };
        });
        return map;
      },
    }
  );
}

/**
 * 按 Tag（tag_1）汇总当周投放情况，与周期表 tag 口径一致（仅用主标签），
 * 并按总投放数取前 limit 名；limit 为空时返回全部（用于查上一期做环比）。
 */
export function useAdTagWeek(start, end, limit = null) {
  const enabled = !!(start && end);
  const sql = enabled
    ? `SELECT tag_1 AS tag,
              COUNT(DISTINCT CASE WHEN (COALESCE(ad_views, 0) + COALESCE(pcebid_views, 0)) > 0 THEN app_id END) AS app_cnt,
              SUM(COALESCE(ad_views, 0) + COALESCE(pcebid_views, 0)) AS total_views,
              SUM(COALESCE(app_ad_views, 0) + COALESCE(app_pcebid_views, 0)) AS app_home,
              SUM(COALESCE(kw_ad_views, 0) + COALESCE(kw_pcebid_views, 0)) AS kw_home,
              SUM(COALESCE(pc_ad_views, 0) + COALESCE(pc_pcebid_views, 0)) AS pc_home
       FROM dws_taptap_ad_aggr_v6_daily
       WHERE crawled_at >= '${start}' AND crawled_at <= '${end}'
         AND tag_1 IS NOT NULL AND tag_1 <> ''
       GROUP BY tag_1
       ORDER BY total_views DESC
       ${limit ? `LIMIT ${limit}` : ''}`
    : '';
  return useChartData(
    `periodic-ad-tag-${start || 'none'}-${end || 'none'}-${limit || 'all'}`,
    (p) => querySqlV09(p.sql),
    { sql },
    {
      enabled,
      staleTime: 10 * 60 * 1000,
      transform: (rows) => {
        const n = (v) => (v == null ? null : Number(v));
        return (rows || []).map((r) => ({
          tag: r.tag == null ? '' : String(r.tag),
          appCnt: n(r.app_cnt),
          totalViews: n(r.total_views),
          appHome: n(r.app_home),
          kwHome: n(r.kw_home),
          pcHome: n(r.pc_home),
        }));
      },
    }
  );
}

/**
 * 投放 Top10：dws_taptap_ad_aggr_v6_periodic_rank（weekly + rank_category='top'）
 * 带总投放数、上周总投放数与增量；渠道拆分由 useAdAppChannelWeek 提供（该表无渠道列）。
 */
export function useAdPeriodicRank(weekKey, limit = 10, category = 'top') {
  const enabled = !!weekKey;
  const sql = enabled
    ? `SELECT rank_no, app_id, app_name, icon, distribution_type,
              tag_1, tag_2, tag_3,
              total_views, prev_total_views, diff_views
       FROM dws_taptap_ad_aggr_v6_periodic_rank
       WHERE period_type = 'weekly' AND rank_category = '${category}' AND crawled_at = '${weekKey}'
       ORDER BY rank_no
       ${limit ? `LIMIT ${limit}` : ''}`
    : '';
  return useChartData(
    `periodic-ad-rank-${weekKey || 'none'}-${category}-${limit}`,
    (p) => querySqlV09(p.sql),
    { sql },
    {
      enabled,
      staleTime: 10 * 60 * 1000,
      transform: (rows) => {
        const n = (v) => (v == null ? null : Number(v));
        return (rows || []).map((r) => ({
          rank: n(r.rank_no),
          appId: r.app_id,
          appName: r.app_name == null ? '' : String(r.app_name),
          icon: r.icon || '',
          distributionType: r.distribution_type == null ? null : Number(r.distribution_type),
          tags: [r.tag_1, r.tag_2, r.tag_3].filter(Boolean).map(String),
          totalViews: n(r.total_views),
          prevTotalViews: n(r.prev_total_views),
          diffViews: n(r.diff_views),
        }));
      },
    }
  );
}

/** 单游戏当周分渠道投放数（app_id → { appHome, kwHome, pcHome }），供榜单渠道列使用 */
export function useAdAppChannelWeek(start, end) {
  const enabled = !!(start && end);
  const sql = enabled
    ? `SELECT app_id,
              SUM(COALESCE(app_ad_views, 0) + COALESCE(app_pcebid_views, 0)) AS app_home,
              SUM(COALESCE(kw_ad_views, 0) + COALESCE(kw_pcebid_views, 0)) AS kw_home,
              SUM(COALESCE(pc_ad_views, 0) + COALESCE(pc_pcebid_views, 0)) AS pc_home
       FROM dws_taptap_ad_aggr_v6_daily
       WHERE crawled_at >= '${start}' AND crawled_at <= '${end}'
       GROUP BY app_id`
    : '';
  return useChartData(
    `periodic-ad-app-channel-${start || 'none'}-${end || 'none'}`,
    (p) => querySqlV09(p.sql),
    { sql },
    {
      enabled,
      staleTime: 10 * 60 * 1000,
      transform: (rows) => {
        const map = {};
        (rows || []).forEach((r) => {
          const n = (v) => (v == null ? null : Number(v));
          map[String(r.app_id)] = { appHome: n(r.app_home), kwHome: n(r.kw_home), pcHome: n(r.pc_home) };
        });
        return map;
      },
    }
  );
}

/** 下载周期汇总（全站口径 category_type='all'）：游戏数 / 总下载 / APP / PC */
export function usePeriodicDownload() {
  return useChartData(
    'periodic-report-download-weekly',
    () =>
      querySqlV09(
        `SELECT crawled_at AS week_key, game_cnt, download_total, download_app, download_pc
         FROM dws_taptap_download_periodic_report
         WHERE period_type = 'weekly' AND category_type = 'all'
         ORDER BY crawled_at DESC`
      ),
    {},
    {
      enabled: true,
      staleTime: 10 * 60 * 1000,
      transform: (rows) => {
        const map = {};
        (rows || []).forEach((r) => {
          const n = (v) => (v == null ? null : Number(v));
          map[r.week_key] = {
            gameCnt: n(r.game_cnt),
            downloadTotal: n(r.download_total),
            downloadApp: n(r.download_app),
            downloadPc: n(r.download_pc),
          };
        });
        return map;
      },
    }
  );
}

/** 下载按游戏类型分布（当周 + 全部历史周次，按 week_key → dist 建映射） */
export function useDownloadDistWeekly() {
  return useChartData(
    'periodic-report-download-dist-weekly',
    () =>
      querySqlV09(
        `SELECT crawled_at AS week_key, category_value, game_cnt, download_total, download_app, download_pc
         FROM dws_taptap_download_periodic_report
         WHERE period_type = 'weekly' AND category_type = 'dist'`
      ),
    {},
    {
      enabled: true,
      staleTime: 10 * 60 * 1000,
      transform: (rows) => {
        const map = {};
        (rows || []).forEach((r) => {
          const n = (v) => (v == null ? null : Number(v));
          const wk = r.week_key;
          if (!map[wk]) map[wk] = {};
          map[wk][Number(r.category_value)] = {
            gameCnt: n(r.game_cnt),
            downloadTotal: n(r.download_total),
            downloadApp: n(r.download_app),
            downloadPc: n(r.download_pc),
          };
        });
        return map;
      },
    }
  );
}

/** 下载 Top20：dws_taptap_download_periodic_rank（weekly + rank_category='top'） */
export function useDownloadPeriodicRank(weekKey, limit = 20, category = 'top') {
  const enabled = !!weekKey;
  const sql = enabled
    ? `SELECT rank_no, app_id, app_name, icon, distribution_type,
              tag_1, tag_2, tag_3,
              total_download, prev_total_download, diff_download
       FROM dws_taptap_download_periodic_rank
       WHERE period_type = 'weekly' AND rank_category = '${category}' AND crawled_at = '${weekKey}'
       ORDER BY rank_no
       ${limit ? `LIMIT ${limit}` : ''}`
    : '';
  return useChartData(
    `periodic-download-rank-${weekKey || 'none'}-${category}-${limit || 'all'}`,
    (p) => querySqlV09(p.sql),
    { sql },
    {
      enabled,
      staleTime: 10 * 60 * 1000,
      transform: (rows) => {
        const n = (v) => (v == null ? null : Number(v));
        return (rows || []).map((r) => ({
          rank: n(r.rank_no),
          appId: r.app_id,
          appName: r.app_name == null ? '' : String(r.app_name),
          icon: r.icon || '',
          distributionType: r.distribution_type == null ? null : Number(r.distribution_type),
          tags: [r.tag_1, r.tag_2, r.tag_3].filter(Boolean).map(String),
          downloadTotal: n(r.total_download),
          prevDownloadTotal: n(r.prev_total_download),
          diffDownload: n(r.diff_download),
        }));
      },
    }
  );
}

/** 单游戏当周 APP / PC 下载数（app_id → { downloadApp, downloadPc }） */
export function useDownloadAppChannelWeek(start, end) {
  const enabled = !!(start && end);
  const sql = enabled
    ? `SELECT app_id,
              SUM(COALESCE(app_download_count, 0)) AS download_app,
              SUM(COALESCE(pc_download_count, 0)) AS download_pc
       FROM dws_taptap_download_daily
       WHERE crawled_at >= '${start}' AND crawled_at <= '${end}'
       GROUP BY app_id`
    : '';
  return useChartData(
    `periodic-download-app-channel-${start || 'none'}-${end || 'none'}`,
    (p) => querySqlV09(p.sql),
    { sql },
    {
      enabled,
      staleTime: 10 * 60 * 1000,
      transform: (rows) => {
        const map = {};
        (rows || []).forEach((r) => {
          const n = (v) => (v == null ? null : Number(v));
          map[String(r.app_id)] = { downloadApp: n(r.download_app), downloadPc: n(r.download_pc) };
        });
        return map;
      },
    }
  );
}

/** 在线周期汇总（全站口径 category_type='all'）：游戏数 / 最大在线 / 平均在线 */
export function usePeriodicOnline() {
  return useChartData(
    'periodic-report-online-weekly',
    () =>
      querySqlV09(
        `SELECT crawled_at AS week_key, game_cnt, peak_online_players, avg_online_players
         FROM dws_taptap_pc_online_peak_players_periodic_report
         WHERE period_type = 'weekly' AND category_type = 'all'
         ORDER BY crawled_at DESC`
      ),
    {},
    {
      enabled: true,
      staleTime: 10 * 60 * 1000,
      transform: (rows) => {
        const map = {};
        (rows || []).forEach((r) => {
          const n = (v) => (v == null ? null : Number(v));
          map[r.week_key] = {
            gameCnt: n(r.game_cnt),
            peakOnline: n(r.peak_online_players),
            avgOnline: r.avg_online_players == null ? null : Math.round(Number(r.avg_online_players)),
          };
        });
        return map;
      },
    }
  );
}

/** 在线榜单类型：list_type → 展示名称 */
export const ONLINE_LISTS = [
  { value: 'app_hot_creative', label: '小游戏', color: '#9CAF9F' },
  { value: 'pc_emulator_played', label: 'PC模拟器', color: '#BFAE8E' },
  { value: 'pc_played', label: 'PC', color: '#8FA3B0' },
];

/** 在线按 list_type 分布（当周 + 历史周次，week_key → list_type 建映射） */
export function useOnlineListWeekly() {
  return useChartData(
    'periodic-report-online-list-weekly',
    () =>
      querySqlV09(
        `SELECT crawled_at AS week_key, category_value, game_cnt, peak_online_players, avg_online_players
         FROM dws_taptap_pc_online_peak_players_periodic_report
         WHERE period_type = 'weekly' AND category_type = 'list'`
      ),
    {},
    {
      enabled: true,
      staleTime: 10 * 60 * 1000,
      transform: (rows) => {
        const map = {};
        (rows || []).forEach((r) => {
          const n = (v) => (v == null ? null : Number(v));
          const wk = r.week_key;
          if (!map[wk]) map[wk] = {};
          map[wk][String(r.category_value)] = {
            gameCnt: n(r.game_cnt),
            peakOnline: n(r.peak_online_players),
            avgOnline: r.avg_online_players == null ? null : Math.round(Number(r.avg_online_players)),
          };
        });
        return map;
      },
    }
  );
}

/** 在线按游戏类型分布（category_type='dist'，week_key → dist 建映射） */
export function useOnlineDistWeekly() {
  return useChartData(
    'periodic-report-online-dist-weekly',
    () =>
      querySqlV09(
        `SELECT crawled_at AS week_key, category_value, game_cnt, peak_online_players, avg_online_players
         FROM dws_taptap_pc_online_peak_players_periodic_report
         WHERE period_type = 'weekly' AND category_type = 'dist'`
      ),
    {},
    {
      enabled: true,
      staleTime: 10 * 60 * 1000,
      transform: (rows) => {
        const map = {};
        (rows || []).forEach((r) => {
          const n = (v) => (v == null ? null : Number(v));
          const wk = r.week_key;
          if (!map[wk]) map[wk] = {};
          map[wk][Number(r.category_value)] = {
            gameCnt: n(r.game_cnt),
            peakOnline: n(r.peak_online_players),
            avgOnline: r.avg_online_players == null ? null : Math.round(Number(r.avg_online_players)),
          };
        });
        return map;
      },
    }
  );
}

/**
 * 在线按 list_type 的 Top 榜单（dws_taptap_pc_online_peak_players_periodic_rank，rank_category='top'）
 * 源表存在并列 rank_no，前端按平均在线人数排序后重编号。
 */
export function useOnlineGameRank(weekKey, category = 'top') {
  const enabled = !!weekKey;
  const sql = enabled
    ? `SELECT list_type, rank_no, app_id, app_name, avg_online_players, prev_avg_online_players, diff_online_players
       FROM dws_taptap_pc_online_peak_players_periodic_rank
       WHERE period_type = 'weekly' AND rank_category = '${category}' AND crawled_at = '${weekKey}'`
    : '';
  return useChartData(
    `periodic-online-rank-${weekKey || 'none'}-${category}`,
    (p) => querySqlV09(p.sql),
    { sql },
    {
      enabled,
      staleTime: 10 * 60 * 1000,
      transform: (rows) => {
        const n = (v) => (v == null ? null : Number(v));
        return (rows || []).map((r) => ({
          listType: String(r.list_type || ''),
          rank: n(r.rank_no),
          appId: r.app_id,
          appName: r.app_name == null ? '' : String(r.app_name),
          avgOnline: n(r.avg_online_players),
          prevAvgOnline: n(r.prev_avg_online_players),
          diffOnline: n(r.diff_online_players),
        }));
      },
    }
  );
}

/**
 * 在线：按游戏类型（distribution_type）取每周各游戏的平均在线人数。
 * 用小时级榜单表聚合（覆盖全部游戏，且与周期榜单的 avg 口径一致）。
 */
export function useOnlineTypeRank(start, end) {
  const enabled = !!(start && end);
  let nextDay = '';
  if (end) {
    const d = new Date(`${String(end).slice(0, 10)}T00:00:00`);
    d.setDate(d.getDate() + 1);
    nextDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const sql = enabled
    ? `SELECT app_id,
              MAX(app_name) AS app_name,
              MAX(distribution_type) AS dist,
              AVG(online_players) AS avg_online
       FROM dws_taptap_pc_online_peak_players_rank_hourly
       WHERE crawled_at >= '${start} 00' AND crawled_at < '${nextDay} 00'
       GROUP BY app_id
       ORDER BY avg_online DESC`
    : '';
  return useChartData(
    `periodic-online-type-rank-${start || 'none'}-${end || 'none'}`,
    (p) => querySqlV09(p.sql),
    { sql },
    {
      enabled,
      staleTime: 10 * 60 * 1000,
      transform: (rows) =>
        (rows || []).map((r) => ({
          appId: r.app_id,
          appName: r.app_name == null ? '' : String(r.app_name),
          distributionType: r.dist == null ? null : Number(r.dist),
          avgOnline: r.avg_online == null ? null : Number(r.avg_online),
        })),
    }
  );
}

/** 在线详情分区的指标行（本期 / 上期） */
export function onlineDetailItems(cur, prev) {
  return [
    { label: '统计的游戏数', value: cur?.gameCnt ?? null, prev: prev?.gameCnt ?? null },
    { label: '最大在线人数', value: cur?.peakOnline ?? null, prev: prev?.peakOnline ?? null },
    { label: '平均在线人数', value: cur?.avgOnline ?? null, prev: prev?.avgOnline ?? null },
  ];
}

/** 下载详情分区的指标行（本期 / 上期） */
export function downloadDetailItems(cur, prev) {
  return [
    { label: '统计的游戏数', value: cur?.gameCnt ?? null, prev: prev?.gameCnt ?? null },
    { label: '总下载数', value: cur?.downloadTotal ?? null, prev: prev?.downloadTotal ?? null },
    { label: 'APP下载数', value: cur?.downloadApp ?? null, prev: prev?.downloadApp ?? null },
    { label: 'PC下载数', value: cur?.downloadPc ?? null, prev: prev?.downloadPc ?? null },
  ];
}

/** 广告详情分区的指标行（本期 / 上期；渠道拆分来自 useAdChannelWeek） */
export function adDetailItems(cur, prev) {
  return [
    { label: '有投放游戏数', value: cur?.appCnt ?? null, prev: prev?.appCnt ?? null },
    { label: '总投放数', value: cur?.totalViews ?? null, prev: prev?.totalViews ?? null },
    { label: 'APP首页投放数', value: cur?.appHome ?? null, prev: prev?.appHome ?? null },
    { label: 'APP搜索页关键词投放数', value: cur?.kwHome ?? null, prev: prev?.kwHome ?? null },
    { label: 'PC首页投放数', value: cur?.pcHome ?? null, prev: prev?.pcHome ?? null },
  ];
}

/** 活跃游戏统计查询 */
export function useActiveStat() {
  return useChartData('periodic-report-active-weekly', () => querySqlV09(ACTIVE_SQL), {}, {
    enabled: true,
    staleTime: 10 * 60 * 1000,
    transform: (rows) => rows || [],
  });
}

/** week_key → { adGames, downloadGames, onlineGames } */
export function buildStatMap(rows) {
  const map = {};
  (rows || []).forEach((r) => {
    map[r.crawled_at] = {
      adGames: r.ad_app_cnt == null ? null : Number(r.ad_app_cnt),
      downloadGames: r.download_app_cnt == null ? null : Number(r.download_app_cnt),
      onlineGames: r.online_players_app_cnt == null ? null : Number(r.online_players_app_cnt),
    };
  });
  return map;
}

/** 小游戏下载数 = 创意工坊(dist_type_1) + TapMaker(dist_type_2) */
export const miniDownload = (r) => (r?.type1 == null && r?.type2 == null ? null : Number(r?.type1 || 0) + Number(r?.type2 || 0));

/** 卡片与详情页共用的分组定义 */
export function metricSections(row, prev, stat, statPrev) {
  return [
    {
      key: 'active',
      color: '#9B93A8',
      title: 'TAPTAP 活跃游戏数',
      items: [
        { label: '【广告】游戏数', value: stat?.adGames ?? null, prev: statPrev?.adGames ?? null },
        { label: '【下载】游戏数', value: stat?.downloadGames ?? null, prev: statPrev?.downloadGames ?? null },
        { label: '【在线】游戏数', value: stat?.onlineGames ?? null, prev: statPrev?.onlineGames ?? null },
      ],
    },
    {
      key: 'ad',
      color: '#BFAE8E',
      title: 'TAPTAP 广告概览',
      items: [
        { label: '抓取到总投放数', value: row.adTotal, prev: prev?.adTotal },
        { label: 'APP 投放数', value: row.adApp, prev: prev?.adApp },
        { label: 'APP 关键词投放数', value: row.adKw, prev: prev?.adKw },
        { label: 'PC 投放数', value: row.adPc, prev: prev?.adPc },
      ],
    },
    {
      key: 'download',
      color: '#7D8F7B',
      title: 'TAPTAP 下载概览',
      items: [
        { label: '总下载数', value: row.downloadTotal, prev: prev?.downloadTotal },
        { label: 'APP 下载数', value: row.downloadApp, prev: prev?.downloadApp },
        { label: 'PC 下载数', value: row.downloadPc, prev: prev?.downloadPc },
        { label: '小游戏下载数', value: miniDownload(row), prev: miniDownload(prev) },
      ],
    },
    {
      key: 'xd',
      color: '#C4A4A4',
      title: 'XD 核心游戏概览',
      labelLines: 2,
      items: [
        { label: '【火炬之光】平均在线人数', value: row.torchlightAvg, prev: prev?.torchlightAvg, decimals: 1 },
        { label: '【火炬之光】新增下载数', value: row.torchlightDownload, prev: prev?.torchlightDownload },
        { label: '【心动小镇】平均在线人数', value: row.heartopiaAvg, prev: prev?.heartopiaAvg, decimals: 1 },
        { label: '【心动小镇】新增下载数', value: row.heartopiaDownload, prev: prev?.heartopiaDownload },
      ],
    },
    {
      key: 'online',
      color: '#8FA3B0',
      title: 'TAPPC 在线人数概览',
      items: [
        { label: '抓取到最大在线人数', value: row.onlinePeakPlayers, prev: prev?.onlinePeakPlayers },
        { label: 'PC 最大在线人数', value: row.onlinePeakPc, prev: prev?.onlinePeakPc },
        { label: 'PC 模拟器最大在线人数', value: row.onlinePeakPcEmulator, prev: prev?.onlinePeakPcEmulator },
        { label: '小游戏最大在线人数', value: row.onlinePeakCreative, prev: prev?.onlinePeakCreative },
      ],
    },
  ];
}

/** 详情页额外汇总的分组（列表卡片不展示） */
export function detailExtraSections(row, prev) {
  return [
    {
      key: 'extra',
      color: '#7A8B99',
      title: '补充明细',
      items: [
        { label: '抓取到游戏数（在线）', value: row.onlineGameCnt, prev: prev?.onlineGameCnt },
        { label: '商业游戏下载数', value: row.type0, prev: prev?.type0 },
        { label: '创意工坊下载数', value: row.type1, prev: prev?.type1 },
        { label: 'TapMaker 下载数', value: row.type2, prev: prev?.type2 },
      ],
    },
  ];
}
