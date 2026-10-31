import { Link } from 'react-router-dom';
import { Section } from './metrics';
import { metricSections } from './data';

/** 一行数据 = 一张周报卡片 */
export default function WeekCard({ row, prev, stat, statPrev }) {
  const weekNo = String(row.weekKey || '').split('-')[1] || '';
  const year = String(row.weekStart || row.weekKey || '').slice(0, 4);
  const today = new Date().toISOString().slice(0, 10);
  // 周报未满 7 天：统计截止日还没过（含当天），本周仍在进行中
  const inProgress = row.weekEnd ? row.weekEnd >= today : false;

  const sections = metricSections(row, prev, stat, statPrev);

  return (
    <div
      className="pr-card h-100 d-flex flex-column"
      style={{
        background: '#fff',
        border: '1px solid #EDF0F2',
        borderRadius: 16,
        boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
        padding: '20px 22px 18px',
      }}
    >
      {/* 头部：期号 + 进行中 + 统计区间 / 年份周次 */}
      <div className="d-flex align-items-start justify-content-between" style={{ gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div className="d-flex align-items-center" style={{ gap: 8 }}>
            <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: 0.2, color: '#232B33' }}>第 {Number(weekNo)} 周</span>
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
          <div style={{ fontSize: 12, color: '#8A959E', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
            {row.weekStart} ~ {row.weekEnd}
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#A7B0B8', letterSpacing: 0.6, whiteSpace: 'nowrap' }}>
          {year} · W{weekNo}
        </div>
      </div>

      {/* 分组 */}
      <div style={{ marginTop: 18 }}>
        {sections.map((s, i) => (
          <Section
            key={s.key}
            color={s.color}
            title={s.title}
            items={s.items}
            hideGrowth={inProgress}
            first={i === 0}
            labelLines={s.labelLines || 1}
          />
        ))}
      </div>

      {/* 备注 + 底部操作 */}
      <div className="mt-auto" style={{ paddingTop: 16 }}>
        {(inProgress || prev == null) && (
          <div style={{ fontSize: 11, color: '#A7B0B8', marginBottom: 10 }}>
            {inProgress ? '本周尚未结束，暂不展示环比' : '上一周期无数据，暂无可比环比'}
          </div>
        )}
        <div className="d-flex justify-content-end" style={{ paddingTop: 12, borderTop: '1px solid #F1F4F6' }}>
          {inProgress ? (
            <button
              type="button"
              disabled
              style={{
                border: '1px solid #EDF0F2',
                background: '#F8FAFB',
                color: '#B6BEC5',
                fontSize: 12,
                fontWeight: 500,
                padding: '6px 14px',
                borderRadius: 10,
                cursor: 'not-allowed',
              }}
              title="本周尚未结束，暂不可查看详细信息"
            >
              <i className="bi bi-lock me-1" style={{ fontSize: 11 }}></i>
              本周尚未结束
            </button>
          ) : (
            <Link
              to={`/periodic-report/detail?week=${encodeURIComponent(row.weekKey)}`}
              style={{
                border: '1px solid #E3E8EC',
                background: '#fff',
                color: '#3B4750',
                fontSize: 12,
                fontWeight: 500,
                padding: '6px 14px',
                borderRadius: 10,
                textDecoration: 'none',
                transition: 'all .15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#7A8B99';
                e.currentTarget.style.color = '#1F272E';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#E3E8EC';
                e.currentTarget.style.color = '#3B4750';
              }}
              title={`查看第 ${Number(weekNo)} 周详细信息`}
            >
              查看详细信息
              <i className="bi bi-arrow-right ms-1" style={{ fontSize: 11 }}></i>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
