import { useCallback, useEffect, useRef, useState } from 'react';
import { DASH_BASE } from './constants';
import DEV_MOCK from './mock';

/** 进程内缓存：切换区块/返回页面不重复拉同一份 JSON */
const cache = new Map();

/**
 * 取大盘静态 JSON。
 * - 命中缓存直接返回，不闪 loading
 * - 404 / 网络错误 → error，区块自己降级成「数据未就绪」，不影响其它区块
 * - 开发环境接口拿不到时回落到本地 mock（生产不会走到这里），并置 mock=true 供页面提示
 */
export default function useStaticJson(file, { enabled = true, bust = 0 } = {}) {
  const key = `${file}#${bust}`;
  const [state, setState] = useState(() => {
    if (!enabled || !file) return { data: null, loading: false, error: null, mock: false };
    return cache.has(key)
      ? { data: cache.get(key), loading: false, error: null, mock: false }
      : { data: null, loading: true, error: null, mock: false };
  });

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !file) return undefined;
    if (cache.has(key)) {
      setState({ data: cache.get(key), loading: false, error: null, mock: false });
      return undefined;
    }

    const ac = new AbortController();
    setState({ data: null, loading: true, error: null, mock: false });

    fetch(`${DASH_BASE}/${file}${bust ? `?t=${bust}` : ''}`, {
      signal: ac.signal,
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((json) => {
        cache.set(key, json);
        if (alive.current) setState({ data: json, loading: false, error: null, mock: false });
      })
      .catch((err) => {
        if (ac.signal.aborted || err.name === 'AbortError') return;
        const mock = import.meta.env.DEV ? DEV_MOCK[file] : undefined;
        if (mock) {
          if (alive.current) setState({ data: mock, loading: false, error: null, mock: true });
          return;
        }
        if (alive.current) setState({ data: null, loading: false, error: err.message, mock: false });
      });

    return () => ac.abort();
  }, [enabled, file, key, bust]);

  return state;
}

/** 手动刷新：清缓存并让 bust 自增，所有区块重新拉 */
export function useRefreshAll() {
  const [bust, setBust] = useState(0);
  const refresh = useCallback(() => {
    cache.clear();
    setBust((n) => n + 1);
  }, []);
  return [bust, refresh];
}
