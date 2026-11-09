import { useSqlQuery } from '../queries';
import { buildTop25DetailSql } from '../sql';
import { transformTop25Detail } from '../transforms';

/** 下载Top25明细查询 hook（小时窗口 + 过滤条件） */
export function useTop25DetailQuery(key, table, selectedWindow, enabled, extraOpts = {}) {
  const opts = { ...table, ...extraOpts };
  return useSqlQuery(
    `taptap-top25-${key}`,
    () => buildTop25DetailSql(selectedWindow, opts),
    [selectedWindow, JSON.stringify(extraOpts)],
    transformTop25Detail,
    { enabled, placeholderData: (prev) => prev }
  );
}
