import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import ChartWrapper from '../charts/ChartWrapper';
import { DEFAULT_RANGE, fetchStats, getLastIdentity, rangeLabel, STATS_RANGES } from '../../api/stats';
import { formatCompactNumber, formatNumber } from '../../utils/formatters';

/** 路由 → 报表名，hover 面板里展示更直观（未命中的路径直接显示原始 path） */
const PATH_LABELS = {
  '/': '首页',
  '/business': 'Games报表',
  '/one-search': 'One Search',
  '/one-search/report': 'One Search 报告',
  '/taptap': 'TapTap报表',
  '/taprep-monthly': 'TapREP月报',
  '/finance': '财务信息',
  '/quant': '量化信息',
  '/reports': '定期报告',
  '/periodic-report': '定期报告',
};

const pathLabel = (path) => PATH_LABELS[path] || path || '-';

/** 身份来源文案：后端 /hit 回来的是实际采用的那一条 */
const IDENTITY_LABELS = {
  sso: '登录账号（SSO）',
  cid: '浏览器匿名 ID',
  fp: 'IP + UA 指纹',
};

/** 面板里 PV 按身份来源拆分的展示顺序与配色 */
const IDENTITY_ROWS = [
  { key: 'sso', label: '登录账号', color: '#4dabf7' },
  { key: 'cid', label: '浏览器 ID', color: '#63e6be' },
  { key: 'fp', label: 'IP + UA', color: '#adb5bd' },
];

const PANEL_WIDTH = 380;
/** 稳定的空数组引用：data 还没到时也让 useMemo 依赖不变，避免每帧重建图表配置 */
const NO_SERIES = [];

/** 数字块（面板里的「浏览量 / 使用人数」） */
function Total({ label, value, hint, decimals = 0 }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 2 }}>{label}</div>
      <div className="fw-semibold" style={{ fontSize: 18, lineHeight: 1.2 }}>
        {formatNumber(value, decimals)}
      </div>
      {hint && <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{hint}</div>}
    </div>
  );
}

/** 徽章尾部的迷你折线（纯 SVG，不引图表库，首屏无额外开销） */
function Sparkline({ values, width = 46, height = 16 }) {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * stepX).toFixed(1)},${(height - 1 - ((v - min) / span) * (height - 2)).toFixed(1)}`)
    .join(' ');
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible', opacity: 0.8 }}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 身份来源拆分条：三段比例 + 图例；看一眼就知道 UV 有没有降级成浏览器指纹 */
function IdentityBar({ identities, total }) {
  const rows = IDENTITY_ROWS.map((row) => ({ ...row, value: Number(identities?.[row.key]) || 0 })).filter(
    (row) => row.value > 0,
  );
  if (!total || rows.length === 0) return null;

  const pct = (value) => (value / total) * 100;
  const fpShare = pct(Number(identities?.fp) || 0);

  return (
    <div style={{ marginTop: 8 }}>
      <div className="d-flex align-items-center justify-content-between" style={{ marginBottom: 3 }}>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>身份来源 · 按浏览量</span>
        {fpShare >= 10 && (
          <span style={{ color: '#ffd8a8', fontSize: 10.5 }}>指纹占 {fpShare.toFixed(0)}%，可推广登录</span>
        )}
      </div>
      <div className="d-flex" style={{ height: 6, borderRadius: 3, overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
        {rows.map((row) => (
          <div
            key={row.key}
            style={{ width: `${pct(row.value)}%`, background: row.color }}
            title={`${row.label} ${formatNumber(row.value)}`}
          ></div>
        ))}
      </div>
      <div className="d-flex flex-wrap" style={{ gap: '2px 10px', marginTop: 3, fontSize: 10.5 }}>
        {rows.map((row) => (
          <span key={row.key} className="d-inline-flex align-items-center" style={{ gap: 4, color: 'rgba(255,255,255,0.55)' }}>
            <span style={{ width: 6, height: 6, borderRadius: 2, background: row.color, display: 'inline-block' }}></span>
            {row.label} {pct(row.value).toFixed(0)}%
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * 访问统计（PV / UV）徽章 + 趋势面板
 * - 默认窗口 = 本周，与老接口 `/week` 数字完全一致
 * - 点徽章展开面板：切换 今天 / 本周 / 近 7 天 / 近 30 天 / 全部，看 PV、UV 曲线与分报表 Top3
 * - 接口失败时整体不渲染，不占位、不报错；数据 5 分钟内不重复拉
 */
export default function VisitStats() {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const pillRef = useRef(null);
  const panelRef = useRef(null);

  const { data, isFetching, isError } = useQuery({
    queryKey: ['visit-stats', range],
    queryFn: () => fetchStats(range),
    // 切窗口时保留上一份数据，避免徽章数字和曲线闪成「—」/空图
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    // 接口 4xx/5xx（未登录、参数错、后端抖动）不给重试，直接按「暂无数据」处理
    retry: (failureCount, error) => !error?.noRetry && failureCount < 1,
    refetchOnWindowFocus: true,
  });

  /** 面板定位：贴在徽章下方，并夹在视口内（窄屏时不溢出右侧） */
  const place = useCallback(() => {
    const el = pillRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 24);
    setPos({
      left: Math.round(Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))),
      top: Math.round(rect.bottom + 8),
      width,
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    place();
    const onDown = (event) => {
      if (panelRef.current?.contains(event.target) || pillRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, place]);

  const series = data?.series ?? NO_SERIES;
  const granularity = data?.granularity || 'day';
  const isEmpty = !!data && !data.pv && !data.uv;

  /** 趋势图配置：PV（左轴）+ 人数（右轴）两条线，x 轴按窗口长度稀疏显示 */
  const chartOptions = useMemo(() => {
    const cats = series.map((item) => item.date);
    const n = cats.length;
    const stride = Math.max(1, Math.ceil(n / 5));
    const shown = new Set(cats.filter((_, i) => i % stride === 0 || i === n - 1));
    const labelOf = (value) => (granularity === 'month' ? String(value).slice(2) : String(value).slice(5));

    return {
      chart: { type: 'line', toolbar: { show: false }, zoom: { enabled: false }, animations: { enabled: false }, background: 'transparent' },
      colors: ['#4dabf7', '#ffc078'],
      stroke: { curve: 'smooth', width: 2 },
      markers: { size: n === 1 ? 4 : 0, hover: { size: 5 } },
      grid: {
        borderColor: 'rgba(255,255,255,0.08)',
        strokeDashArray: 3,
        padding: { left: 2, right: 2, top: 0, bottom: 0 },
      },
      dataLabels: { enabled: false },
      legend: {
        show: true,
        position: 'top',
        horizontalAlign: 'left',
        fontSize: '11px',
        itemMargin: { horizontal: 8, vertical: 0 },
        labels: { colors: 'rgba(255,255,255,0.7)' },
        markers: { size: 5 },
      },
      xaxis: {
        categories: cats,
        labels: {
          style: { colors: 'rgba(255,255,255,0.45)', fontSize: '10px' },
          formatter: (value) => (shown.has(value) ? labelOf(value) : ''),
          rotate: 0,
          hideOverlappingLabels: false,
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
        tooltip: { enabled: false },
      },
      yaxis: [
        {
          labels: {
            style: { colors: 'rgba(255,255,255,0.45)', fontSize: '10px' },
            formatter: (value) => formatCompactNumber(Math.round(value)),
          },
          axisBorder: { show: false },
          axisTicks: { show: false },
        },
        {
          opposite: true,
          labels: {
            style: { colors: 'rgba(255,199,120,0.6)', fontSize: '10px' },
            formatter: (value) => formatCompactNumber(Math.round(value)),
          },
          axisBorder: { show: false },
          axisTicks: { show: false },
        },
      ],
      tooltip: {
        theme: 'dark',
        shared: true,
        intersect: false,
        style: { fontSize: '11px' },
        // 类别轴：直接回 x 标签（默认会显示「第几个点」的索引）
        x: { formatter: (_value, opts) => cats[opts?.dataPointIndex ?? 0] ?? '' },
        y: { formatter: (value) => formatNumber(value) },
      },
    };
  }, [series, granularity]);

  const chartSeries = useMemo(
    () => [
      { name: '浏览量', data: series.map((item) => item.pv) },
      { name: '使用人数', data: series.map((item) => item.uv) },
    ],
    [series],
  );

  // 接口失败（未登录 / 后端抖动）→ 不渲染，避免导航栏出现假数字
  if (isError) return null;
  if (!data && !isFetching) return null;

  const identity = IDENTITY_LABELS[getLastIdentity()] || '';
  const rangeText = rangeLabel(range);

  return (
    <>
      <button
        ref={pillRef}
        type="button"
        className="d-none d-xl-inline-flex align-items-center rounded-pill"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="点击查看访问趋势（浏览量已按「同一页面 30 分钟」去重）"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          gap: 8,
          padding: '3px 10px',
          fontSize: 12,
          lineHeight: '18px',
          color: 'rgba(255,255,255,0.75)',
          backgroundColor: open ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          opacity: data ? 1 : 0.55,
        }}
      >
        <span className="d-inline-flex align-items-center" style={{ gap: 4 }}>
          <i className="bi bi-eye" style={{ fontSize: 12 }}></i>
          浏览 <span className="fw-semibold text-white">{data ? formatNumber(data.pv) : '—'}</span>
        </span>
        <span style={{ opacity: 0.35 }}>|</span>
        <span className="d-inline-flex align-items-center" style={{ gap: 4 }}>
          <i className="bi bi-person" style={{ fontSize: 12 }}></i>
          人数 <span className="fw-semibold text-white">{data ? formatNumber(data.uv) : '—'}</span>
        </span>
        {data && <Sparkline values={series.map((item) => item.pv)} />}
        <i
          className="bi bi-chevron-down"
          style={{ fontSize: 9, opacity: 0.55, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
        ></i>
      </button>

      {open && pos && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="访问趋势"
          style={{
            position: 'fixed',
            left: pos.left,
            top: pos.top,
            width: pos.width,
            maxHeight: 'calc(100vh - 80px)',
            overflowY: 'auto',
            zIndex: 2000,
            background: 'rgba(28,32,36,0.98)',
            color: '#fff',
            borderRadius: 10,
            padding: '12px 14px 10px',
            fontSize: 12,
            lineHeight: 1.7,
            boxShadow: '0 10px 32px rgba(0,0,0,0.38)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {/* 头部：标题 + 窗口切换 */}
          <div className="d-flex align-items-center justify-content-between" style={{ gap: 10, marginBottom: 8 }}>
            <span className="fw-semibold d-inline-flex align-items-center" style={{ gap: 6, whiteSpace: 'nowrap' }}>
              访问趋势
              {data?.mock && (
                <span
                  style={{
                    fontSize: 10,
                    padding: '0 4px',
                    borderRadius: 3,
                    color: '#ffd8a8',
                    border: '1px solid rgba(255,216,168,0.45)',
                  }}
                >
                  模拟
                </span>
              )}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, whiteSpace: 'nowrap' }}>
              {data?.start} ~ {data?.end}
            </span>
          </div>

          <div className="d-flex flex-wrap" style={{ gap: 4, marginBottom: 10 }}>
            {STATS_RANGES.map((item) => {
              const active = item.value === range;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setRange(item.value)}
                  style={{
                    border: `1px solid ${active ? 'rgba(77,171,247,0.75)' : 'rgba(255,255,255,0.14)'}`,
                    background: active ? 'rgba(77,171,247,0.22)' : 'transparent',
                    color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                    borderRadius: 999,
                    padding: '1px 9px',
                    fontSize: 11,
                    lineHeight: '18px',
                    cursor: 'pointer',
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="d-flex align-items-start" style={{ gap: 20, marginBottom: 4 }}>
            <Total label={`浏览量 · ${rangeText}`} value={data?.pv ?? 0} />
            <Total label="使用人数（去重）" value={data?.uv ?? 0} hint={identity ? `按${identity}去重` : undefined} />
            {data?.pv > 0 && data?.uv > 0 && (
              <Total label="人均浏览" value={data.pv / data.uv} decimals={1} />
            )}
          </div>

          <div style={{ marginTop: 2 }}>
            {isFetching && !data ? (
              <div
                className="d-flex align-items-center justify-content-center"
                style={{ height: 132, color: 'rgba(255,255,255,0.45)', fontSize: 11 }}
              >
                加载中…
              </div>
            ) : isEmpty ? (
              <div
                className="d-flex align-items-center justify-content-center"
                style={{ height: 132, color: 'rgba(255,255,255,0.4)', fontSize: 11 }}
              >
                该时间窗口还没有访问记录
              </div>
            ) : (
              <ChartWrapper
                options={chartOptions}
                series={chartSeries}
                type="line"
                height={132}
                loading={isFetching && !series.length}
              />
            )}
          </div>

          {!isEmpty && <IdentityBar identities={data?.identities} total={data?.pv} />}

          {data?.topPaths?.length > 0 && (
            <>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', margin: '6px 0 6px' }}></div>
              <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>访问最多的报表</div>
              {data.topPaths.map((item, idx) => (
                <div key={item.path} className="d-flex align-items-center justify-content-between" style={{ gap: 16 }}>
                  <span className="text-truncate" style={{ maxWidth: 190 }} title={item.path}>
                    {idx + 1}. {pathLabel(item.path)}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap' }}>
                    {formatNumber(item.pv)} / {formatNumber(item.uv)}
                  </span>
                </div>
              ))}
              <div style={{ color: 'rgba(255,255,255,0.35)', marginTop: 4, fontSize: 11 }}>
                右侧为 浏览量 / 使用人数
              </div>
            </>
          )}

          <div style={{ color: 'rgba(255,255,255,0.3)', marginTop: 6, fontSize: 10.5 }}>
            {granularity === 'month' ? '跨度较长，曲线按「月」聚合' : '曲线按天聚合，缺数据按 0 补齐'}
            {isFetching && data ? ' · 更新中' : ''}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.42)', fontSize: 10.5 }}>
            浏览量为去重后口径：同一页面 30 分钟内不重复计
          </div>
        </div>
      )}
    </>
  );
}
