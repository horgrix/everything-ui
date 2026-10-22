/** 更新频率标签（副标题，标签风格）；配合 updateTime.js 的 nextUpdateLabel 使用 */
export default function UpdateTag({ text }) {
  return (
    <span
      className="badge rounded-pill fw-normal d-inline-flex align-items-center"
      title={text}
      style={{
        background: '#EDEFF2',
        color: '#7A8B99',
        fontSize: 11,
        fontWeight: 400,
        padding: '3px 10px',
        border: '1px solid #E3E7EB',
      }}
    >
      <i className="bi bi-clock-history me-1"></i>
      {text}
    </span>
  );
}
