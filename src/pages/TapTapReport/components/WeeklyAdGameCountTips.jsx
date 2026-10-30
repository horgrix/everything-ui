import { useState } from 'react';
import { useSqlQuery } from '../queries';
import { buildAdGameCountDailySql } from '../sql';
import { transformAdGameCountWeekly } from '../transforms';

/** 弹框宽度（视口不够时自动收窄） */
const BOX_WIDTH = 520;
/** 估算弹框高度：视口下方空间不足时改为向上展开 */
const BOX_HEIGHT = 470;

/** 百分比增减着色：正绿负红，空值显示 - */
function DeltaText({ value }) {
  if (value == null) return <span className="text-muted">-</span>;
  const cls = value > 0 ? 'text-success' : value < 0 ? 'text-danger' : 'text-muted';
  return (
    <span className={cls} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {value > 0 ? '+' : ''}
      {value}%
    </span>
  );
}

const CELL_STYLE = { fontSize: 11, padding: '3px 4px', textAlign: 'center', whiteSpace: 'nowrap' };
const ROW_LABEL_STYLE = { ...CELL_STYLE, textAlign: 'left', color: '#6c757d', width: 56 };

/**
 * 一张「上周 / 本周 / 增幅(%)」× 周一~周日的对比表
 * @param {string} title 表标题
 * @param {string} subtitle 右侧说明
 * @param {Array} labels 周几标签
 * @param {Array} lastWeek 上周 7 个值
 * @param {Array} thisWeek 本周 7 个值
 * @param {Array} delta 7 个增幅(%)
 * @param {number} todayIndex 今天是周几（周一=0）；该列增幅记为「未结束」
 */
function CompareTable({ title, subtitle, labels, lastWeek, thisWeek, delta, todayIndex = -1 }) {
  const cell = (v, extra) =>
    v == null ? (
      <span className="text-muted">-</span>
    ) : (
      <span style={{ fontVariantNumeric: 'tabular-nums', ...extra }}>{v}</span>
    );

  return (
    <div className="mb-2">
      <div className="d-flex align-items-center justify-content-between mb-1">
        <span className="fw-semibold" style={{ fontSize: 12 }}>
          {title}
        </span>
        <span className="text-muted" style={{ fontSize: 11 }}>
          {subtitle}
        </span>
      </div>
      <table className="table table-sm table-borderless mb-0">
        <thead>
          <tr>
            <th style={{ ...CELL_STYLE, textAlign: 'left', color: '#adb5bd', fontWeight: 500, width: 56 }}></th>
            {labels.map((l) => (
              <th key={l} style={{ ...CELL_STYLE, color: '#adb5bd', fontWeight: 500 }}>
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={ROW_LABEL_STYLE}>上周</td>
            {lastWeek.map((v, i) => (
              <td key={i} style={CELL_STYLE}>
                {cell(v)}
              </td>
            ))}
          </tr>
          <tr>
            <td style={ROW_LABEL_STYLE}>本周</td>
            {thisWeek.map((v, i) => (
              <td key={i} style={{ ...CELL_STYLE, fontWeight: 600 }}>
                {cell(v)}
              </td>
            ))}
          </tr>
          <tr>
            <td style={ROW_LABEL_STYLE}>增幅(%)</td>
            {delta.map((v, i) => (
              <td key={i} style={CELL_STYLE}>
                {i === todayIndex ? (
                  <span className="text-muted" style={{ fontSize: 10 }}>
                    未结束
                  </span>
                ) : (
                  <DeltaText value={v} />
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * 「投放游戏数概览」提示标签：悬停弹出三张「本周 vs 上周」按周几的对比表
 * 1) 投放游戏数概览 —— 每日有投放的游戏数
 * 2) 广告投放数概览 —— 每日广告投放次数
 * 3) 平均投放数 —— 每个游戏平均广告数（广告数 ÷ 游戏数）
 * 数据源 dws_taptap_ad_aggr_v5_daily；弹框 fixed 定位，避免被卡片或表格容器裁剪。
 */
export default function WeeklyAdGameCountTips() {
  const [pos, setPos] = useState(null);
  const { data, isLoading, error } = useSqlQuery(
    'taptap-ad-game-count-weekly',
    buildAdGameCountDailySql,
    [],
    transformAdGameCountWeekly,
    { staleTime: 5 * 60 * 1000 },
  );

  const labels = data?.labels || ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const blank = new Array(7).fill(null);
  // 今天是周几（周一=0）：当日数据未跑完，增幅显示「未结束」
  const todayIndex = (new Date().getDay() + 6) % 7;

  const handleEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const boxWidth = Math.min(BOX_WIDTH, window.innerWidth - 24);
    // 左边缘对齐标签左边缘，并夹在视口内；下方空间不足时向上展开
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - boxWidth - 12));
    const below = rect.bottom + 6;
    const top = below + BOX_HEIGHT > window.innerHeight ? Math.max(12, rect.top - BOX_HEIGHT - 6) : below;
    setPos({ left, top, width: boxWidth });
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
        <i className="bi bi-info-circle" style={{ fontSize: 11 }}></i>
        <span>投放游戏数概览</span>
      </span>

      {pos && (
        <div
          style={{
            position: 'fixed',
            left: pos.left,
            top: pos.top,
            width: pos.width,
            background: '#fff',
            border: '1px solid #dee2e6',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: '10px 12px',
            zIndex: 2000,
            textAlign: 'left',
          }}
        >
          {error ? (
            <div className="text-danger" style={{ fontSize: 12 }}>
              <i className="bi bi-exclamation-triangle me-1"></i>
              {error.message}
            </div>
          ) : (
            <>
              <CompareTable
                title="投放游戏数概览"
                subtitle="每日有投放的游戏数（本周 vs 上周）"
                labels={labels}
                lastWeek={data?.lastWeek || blank}
                thisWeek={data?.thisWeek || blank}
                delta={data?.delta || blank}
                todayIndex={todayIndex}
              />
              <CompareTable
                title="广告投放数概览"
                subtitle="每日投放广告数（本周 vs 上周）"
                labels={labels}
                lastWeek={data?.lastPushes || blank}
                thisWeek={data?.thisPushes || blank}
                delta={data?.pushDelta || blank}
                todayIndex={todayIndex}
              />
              <CompareTable
                title="平均投放数"
                subtitle="每个游戏平均广告数（本周 vs 上周）"
                labels={labels}
                lastWeek={data?.lastPerGame || blank}
                thisWeek={data?.thisPerGame || blank}
                delta={data?.perGameDelta || blank}
                todayIndex={todayIndex}
              />
            </>
          )}

          {isLoading && (
            <div className="text-muted" style={{ fontSize: 11 }}>
              加载中…
            </div>
          )}
          {data && <div className="text-muted" style={{ fontSize: 10 }}>广告数 = 商业AD + 资源互换AD；平均投放数 = 广告数 ÷ 当日有投放的游戏数</div>}
        </div>
      )}
    </span>
  );
}
