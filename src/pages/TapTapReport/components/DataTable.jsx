import { useState } from 'react';
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

/**
 * 通用数据表格（列配置驱动 + 排名列 + 分页）
 * @param {Array} rows 数据行
 * @param {Array} columns [{ header, align?: 'end', render(row) }]
 * @param {number} pageSize 每页行数
 */
export default function DataTable({ rows, columns, pageSize = 5 }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalCols = columns.length + 1; // +1 排名列

  return (
    <div className="card-body p-0">
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th className="text-center" style={{ width: 60 }}>#</th>
              {columns.map((c) => (
                <th key={c.header} className={c.align === 'end' ? 'text-end' : ''}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedRows.length ? (
              pagedRows.map((row, idx) => {
                const rank = (currentPage - 1) * pageSize + idx + 1;
                return (
                  <tr key={idx}>
                    <td className="text-center" style={{ width: 60 }}>
                      <RankBadge rank={rank} />
                    </td>
                    {columns.map((c) => (
                      <td key={c.header} className={c.align === 'end' ? 'text-end' : ''}>{c.render(row)}</td>
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
