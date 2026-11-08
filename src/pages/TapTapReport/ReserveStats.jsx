import { useSqlQuery } from './queries';

/**
 * TapTap预约统计
 *
 * 目前上游还没有预约口径的数据表（SQLite 62 张表、MySQL 31 张表里都没有 reserve/appoint 相关表），
 * 所以这里先给出页面骨架与对接说明。等上游建好表后，只需要：
 *   1) 把 RESERVE_TABLE 换成真实表名
 *   2) 按实际列填 buildReserveTrendSql / buildReserveTopSql 的字段
 * 页面结构与下载统计保持一致（KPI → 趋势 → 明细榜）。
 */
const RESERVE_TABLE = null;

/** 预约趋势 SQL（占位：表接入后按实际列改写） */
function buildReserveTrendSql() {
  if (!RESERVE_TABLE) return null;
  return `
    SELECT crawled_at, SUM(reserve_count) AS reserve_count
    FROM ${RESERVE_TABLE}
    ORDER BY crawled_at
  `;
}

export default function ReserveStats() {
  const trendSql = buildReserveTrendSql();
  // 表未接入前不发请求（enabled=false），避免无谓的报错
  const trendQuery = useSqlQuery('taptap-reserve-trend', () => trendSql, [trendSql], null, { enabled: !!trendSql });

  return (
    <>
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-0">
          <div className="fw-semibold">TapTap预约统计</div>
          <div className="text-muted small mt-1">预约趋势 / 预约榜 / 明细（口径待上游数据表接入）</div>
        </div>
        <div className="card-body">
          <div
            className="d-flex gap-2 px-3 py-3 rounded-3"
            style={{ backgroundColor: '#FFF9EC', border: '1px solid #F1E3C3' }}
          >
            <i
              className="bi bi-exclamation-triangle-fill"
              style={{ fontSize: 14, lineHeight: '22px', color: '#C08A2E' }}
              aria-hidden="true"
            ></i>
            <div style={{ fontSize: 12.5, lineHeight: '22px', color: '#7A5C22' }}>
              页面已就位，等待预约数据表接入。
              <div className="mt-1">
                当前库里没有预约口径的表（SQLite 62 张 / MySQL 31 张均已核对，无 reserve / appoint 相关表）。
              </div>
              <div className="mt-1">
                需要提供：① 表名（小时/日粒度）② 预约相关列（累计预约数、新增预约数、游戏维度字段）
                ③ 是否需要按游戏类型（商业游戏 / 独立小游戏 / Maker小游戏）拆分。拿到后我会按现有视觉直接接上。
              </div>
            </div>
          </div>

          {trendQuery.error && (
            <div className="text-danger small mt-2">{trendQuery.error.message}</div>
          )}
        </div>
      </div>
    </>
  );
}
