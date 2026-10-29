import { useEffect, useMemo, useRef, useState } from 'react';

/** 玻璃碎裂动画时长（需与 index.scss 里 osShardFly 保持一致） */
export const SHATTER_MS = 780;
/** 最短展示时长：数据回得快时也保证过场可见，避免只闪一下 */
export const MIN_VISIBLE_MS = 900;

/** 生成铺满视口的玻璃碎片（每片带随机顶点抖动与飞散方向） */
function useShards(cols = 6, rows = 4) {
  return useMemo(() => {
    const list = [];
    const w = 100 / cols;
    const h = 100 / rows;
    const jitter = (span) => (Math.random() - 0.5) * span;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const left = c * w;
        const top = r * h;
        const pts = [
          [left + jitter(w * 0.5), top + jitter(h * 0.5)],
          [left + w + jitter(w * 0.5), top + jitter(h * 0.5)],
          [left + w + jitter(w * 0.5), top + h + jitter(h * 0.5)],
          [left + jitter(w * 0.5), top + h + jitter(h * 0.5)],
        ]
          .map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`)
          .join(', ');

        // 距画面中心的距离决定飞散力度，整体向外炸开
        const cx = left + w / 2;
        const cy = top + h / 2;
        const spread = 1.9;
        list.push({
          key: `${r}-${c}`,
          left,
          top,
          w,
          h,
          clipPath: `polygon(${pts})`,
          dx: `${(((cx - 50) * spread) + jitter(12)).toFixed(1)}vw`,
          dy: `${(((cy - 50) * spread) + jitter(12)).toFixed(1)}vh`,
          rot: `${((Math.random() - 0.5) * 120).toFixed(0)}deg`,
          delay: `${Math.round(Math.random() * 90)}ms`,
        });
      }
    }
    return list;
  }, [cols, rows]);
}

/**
 * One Search 加载过场：0→100% 进度 + 玻璃碎裂（原在首页点 Search 时播放，现改由结果页加载触发）。
 * @param {number} progress 0~1 的真实加载进度（首屏查询完成比例）
 * @param {boolean} ready 首屏数据是否已全部返回；为 true 时补到 100% 再碎裂收起
 * @param {string} label 遮罩底部提示文案
 */
export default function SearchLoadingOverlay({ progress = 0, ready = false, label = '' }) {
  const shards = useShards();
  const [percent, setPercent] = useState(4);
  const [phase, setPhase] = useState('loading'); // loading | shatter | done
  const percentRef = useRef(4);
  const startRef = useRef(performance.now());
  const phaseRef = useRef('loading');
  phaseRef.current = phase;

  useEffect(() => {
    let stopped = false;
    let raf = 0;
    let timer = 0;
    const tick = () => {
      if (stopped || phaseRef.current !== 'loading') return;
      // 时间驱动 + 数据上限：真实进度慢时按数据走，数据回得快也至少铺满最短展示时长
      const elapsed = performance.now() - startRef.current;
      const settled = ready && elapsed >= MIN_VISIBLE_MS;
      const dataTarget = ready ? 100 : Math.max(6, Math.min(97, Math.round(progress * 100)));
      const timeTarget = Math.min(100, (elapsed / MIN_VISIBLE_MS) * 100);
      const target = Math.min(dataTarget, timeTarget);
      const cur = percentRef.current;
      const next = Math.min(100, cur + Math.max(0.9, (target - cur) * 0.16));
      percentRef.current = next;
      setPercent(next);
      if (settled && next >= 99.6) {
        setPhase('shatter');
        timer = window.setTimeout(() => setPhase('done'), SHATTER_MS);
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [progress, ready]);

  if (phase === 'done') return null;

  return (
    <>
      {phase === 'loading' && (
        <div className="os-overlay">
          <div
            className="text-white fw-bold"
            style={{ fontSize: 96, lineHeight: 1, letterSpacing: 2, fontVariantNumeric: 'tabular-nums' }}
          >
            {Math.round(percent)}%
          </div>
          <div style={{ width: 280, height: 4, background: 'rgba(255,255,255,0.18)', borderRadius: 2, overflow: 'hidden', marginTop: 20 }}>
            <div style={{ width: `${percent}%`, height: '100%', background: '#fff' }} />
          </div>
          {label && <div className="text-white-50 mt-3 small">{label}</div>}
        </div>
      )}

      {phase === 'shatter' && (
        <div className="os-shard-stage">
          {shards.map((s) => (
            <div
              key={s.key}
              className="os-shard"
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: `${s.w}%`,
                height: `${s.h}%`,
                clipPath: s.clipPath,
                animationDelay: s.delay,
                '--os-dx': s.dx,
                '--os-dy': s.dy,
                '--os-rot': s.rot,
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
