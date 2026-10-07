import { useMemo, useState } from 'react';
import {
  useLegacyTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
} from '@tanstack/react-table/legacy';
import { formatNumber } from '../../../utils/formatters';

/** 排名徽章：Top3 彩色，其余灰色数字 */
function RankBadge({ rank }) {
  if (rank <= 3) {
    const cls = rank === 1 ? 'bg-warning text-dark' : rank === 2 ? 'bg-secondary' : 'bg-danger';
    return <span className={`badge ${cls}`}>{rank}</span>;
  }
  return <span className="text-muted">{rank}</span>;
}

/** 增长/增长率着色单元格（正绿负红，带 + 前缀） */
export function GrowthCell({ value, percent = false }) {
  if (value == null) return '-';
  const text = `${value > 0 ? '+' : ''}${percent ? value : formatNumber(value)}${percent ? '%' : ''}`;
  return <span className={value > 0 ? 'text-success' : value < 0 ? 'text-danger' : ''}>{text}</span>;
}

/** 表头提示：问号图标 + 悬浮提示（fixed 定位避免被表格容器裁剪） */
function HeaderHelp({ help }) {
  const [pos, setPos] = useState(null);
  return (
    <span
      className="ms-1 text-muted"
      style={{ cursor: 'help', display: 'inline-flex', verticalAlign: 'middle' }}
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPos({ x: rect.left + rect.width / 2, y: rect.bottom + 6 });
      }}
      onMouseLeave={() => setPos(null)}
    >
      <i className="bi bi-question-circle"></i>
      {pos && (
        <div style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          transform: 'translateX(-50%)',
          background: 'rgba(33,37,41,0.95)',
          color: '#fff',
          padding: '8px 10px',
          borderRadius: 6,
          fontSize: 12,
          lineHeight: 1.5,
          whiteSpace: 'pre-line',
          width: 220,
          zIndex: 2000,
          textAlign: 'left',
          fontWeight: 400,
          pointerEvents: 'none',
        }}>
          {Array.isArray(help) ? (
            help.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: idx < help.length - 1 ? 4 : 0 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: item.color, display: 'inline-block', flexShrink: 0 }} />
                <span>{item.text}</span>
              </div>
            ))
          ) : (
            help
          )}
        </div>
      )}
    </span>
  );
}

/** 排名列占位 id（不参与排序/筛选） */
const RANK_COLUMN_ID = '__rank__';

/**
 * 通用数据表格（列配置驱动 + 排名列 + 排序 + 全局搜索 + 分页）
 * @param {Array} rows 数据行
 * @param {Array} columns [{ header, align?: 'end', accessor?: (row)=>any, render(row) }]
 * @param {number} pageSize 每页行数
 *
 * 排序：有 accessor 的列表头可点击，循环「升序 → 降序 → 取消」，表头显示 ▲/▼。
 * 筛选：顶部全局搜索框，对「有 accessor 的列」取值做忽略大小写的 contains 匹配。
 */
export default function DataTable({ rows, columns, pageSize = 5, totalRow = null, fixedLayout = false, rankColWidth = 60 }) {
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const tableColumns = useMemo(() => [
    { id: RANK_COLUMN_ID, header: '#', enableSorting: false, enableGlobalFilter: false },
    ...columns.map((c, i) => {
      const sortable = typeof c.accessor === 'function';
      return {
        id: c.header || `col-${i}`,
        header: c.header,
        accessorFn: c.accessor,
        enableSorting: sortable,
        enableGlobalFilter: sortable,
      };
    }),
  ], [columns]);

  const table = useLegacyTable({
    data: rows,
    columns: tableColumns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const modelRows = table.getRowModel().rows;
  const totalPages = Math.max(1, Math.ceil(modelRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = modelRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalCols = columns.length + 1; // +1 排名列

  const sortStateOf = (colId) => sorting.find((s) => s.id === colId);

  const toggleSort = (colId) => {
    setSorting((prev) => {
      const existing = prev.find((s) => s.id === colId);
      if (!existing) return [{ id: colId, desc: false }];
      if (!existing.desc) return [{ id: colId, desc: true }];
      return [];
    });
  };

  return (
    <div className="card-body p-0">
      <div className="p-3 d-flex justify-content-end">
        <div className="input-group input-group-sm" style={{ maxWidth: 300 }}>
          <span className="input-group-text"><i className="bi bi-search"></i></span>
          <input
            type="text"
            className="form-control"
            placeholder="搜索…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
          {globalFilter && (
            <button
              type="button"
              className="btn btn-outline-secondary"
              aria-label="清除搜索"
              onClick={() => setGlobalFilter('')}
            >
              <i className="bi bi-x-lg"></i>
            </button>
          )}
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0" style={fixedLayout ? { tableLayout: 'fixed' } : undefined}>
          <thead className="table-light">
            <tr>
              <th className="text-center" style={{ width: rankColWidth }}>#</th>
              {columns.map((c, i) => {
                const colId = c.header || `col-${i}`;
                const sortable = typeof c.accessor === 'function';
                const sortState = sortStateOf(colId);
                return (
                  <th
                    key={colId}
                    className={c.align === 'end' ? 'text-end' : c.align === 'center' ? 'text-center' : ''}
                    onClick={sortable ? () => toggleSort(colId) : undefined}
                    role={sortable ? 'button' : undefined}
                    style={{
                      ...(sortable ? { cursor: 'pointer', userSelect: 'none' } : {}),
                      ...(c.width ? { width: c.width, minWidth: c.width, maxWidth: c.width } : {}),
                    }}
                  >
                    {c.header}
                    {c.help && <HeaderHelp help={c.help} />}
                    {sortable && (
                      <span className="ms-1 text-primary">
                        {sortState?.desc === false ? '▲' : sortState?.desc === true ? '▼' : ''}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pagedRows.length ? (
              pagedRows.map((rowModel, idx) => {
                const row = rowModel.original;
                const rank = (currentPage - 1) * pageSize + idx + 1;
                return (
                  <tr key={idx}>
                    <td className="text-center" style={{ width: rankColWidth }}>
                      <RankBadge rank={rank} />
                    </td>
                    {columns.map((c, i) => (
                      <td key={c.header || `col-${i}`} className={c.align === 'end' ? 'text-end' : c.align === 'center' ? 'text-center' : ''} style={c.width ? { width: c.width, minWidth: c.width, maxWidth: c.width } : undefined}>{c.render(row)}</td>
                    ))}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={totalCols} className="text-center text-muted py-4">暂无数据</td>
              </tr>
            )}
          </tbody>
          {totalRow && (
            <tfoot className="table-light fw-semibold">
              <tr>
                <td className="text-center" style={{ width: rankColWidth }}>Σ</td>
                {columns.map((c, i) => (
                  <td key={c.header || `col-${i}`} className={c.align === 'end' ? 'text-end' : c.align === 'center' ? 'text-center' : ''} style={c.width ? { width: c.width, minWidth: c.width, maxWidth: c.width } : undefined}>
                    {c.render ? c.render(totalRow) : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {totalPages > 1 && (
        <div className="d-flex justify-content-center p-3">
          <nav><ul className="pagination pagination-sm mb-0">
            <li className={`page-item ${currentPage <= 1 ? 'disabled' : ''}`}>
              <button className="page-link" onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</button>
            </li>
            <li className="page-item disabled"><span className="page-link">{currentPage} / {totalPages}</span></li>
            <li className={`page-item ${currentPage >= totalPages ? 'disabled' : ''}`}>
              <button className="page-link" onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>下一页</button>
            </li>
          </ul></nav>
        </div>
      )}
    </div>
  );
}
