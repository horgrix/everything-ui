import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/** 加载时长（毫秒） */
const LOADING_MS = 3000;
/** 玻璃碎裂动画时长（需与 index.scss 里 osShardFly 保持一致） */
const SHATTER_MS = 780;

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
 * One Search：标题 + 搜索框；点击 Search 后加载 3 秒（0→100%），
 * 随后整页玻璃碎裂并进入报表页面。
 */
export default function OneSearch() {
  const [keyword, setKeyword] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | loading | shatter
  const [percent, setPercent] = useState(0);
  const inputRef = useRef(null);
  const rafRef = useRef(0);
  const timeoutsRef = useRef([]);
  const navigate = useNavigate();
  const shards = useShards();

  useEffect(() => {
    inputRef.current?.focus();
    const timeouts = timeoutsRef.current;
    return () => {
      cancelAnimationFrame(rafRef.current);
      timeouts.forEach(clearTimeout);
    };
  }, []);

  const handleSearch = () => {
    const value = keyword.trim();
    if (!value || phase !== 'idle') return;

    setPhase('loading');
    setPercent(0);
    const start = performance.now();

    const step = (now) => {
      const p = Math.min(100, ((now - start) / LOADING_MS) * 100);
      setPercent(p);
      if (p < 100) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      // 加载完成 → 玻璃碎裂 → 进入报表页
      setPhase('shatter');
      timeoutsRef.current.push(
        setTimeout(() => {
          navigate(`/one-search/report?q=${encodeURIComponent(value)}`);
        }, SHATTER_MS)
      );
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const busy = phase === 'loading' || phase === 'shatter';

  return (
    <>
      <div className="position-relative" style={{ minHeight: 'calc(100vh - 120px)' }}>
        {/* 标题：页面 30% 高度处 */}
        <div
          className="position-absolute start-50 translate-middle-x text-center"
          style={{ top: '30vh', width: '100%', maxWidth: 860, paddingLeft: 16, paddingRight: 16 }}
        >
          <div className="fw-bold" style={{ fontSize: 30, letterSpacing: 1 }}>
            游戏线索查询
          </div>
        </div>

        {/* 搜索框 + 按钮：页面 40% 高度处 */}
        <div
          className="position-absolute start-50 translate-middle-x"
          style={{ top: '40vh', width: '100%', maxWidth: 860, paddingLeft: 16, paddingRight: 16 }}
        >
          <div className="input-group input-group-lg shadow-sm">
            <input
              ref={inputRef}
              type="text"
              className="form-control form-control-lg"
              placeholder="搜索…"
              value={keyword}
              disabled={busy}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
              aria-label="搜索关键词"
              style={{ height: 64, fontSize: 18 }}
            />
            <button
              type="button"
              className="btn btn-primary btn-lg px-4 fw-semibold"
              onClick={handleSearch}
              disabled={busy}
              style={{ height: 64, fontSize: 18 }}
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {/* 加载遮罩（固定 3 秒，百分比 0→100） */}
      {busy && (
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
          <div className="text-white-50 mt-3 small">正在检索「{keyword.trim()}」…</div>
        </div>
      )}

      {/* 玻璃碎裂 */}
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
