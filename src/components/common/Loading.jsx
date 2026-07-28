export default function Loading({ text = '加载中...' }) {
  return (
    <div className="d-flex justify-content-center align-items-center p-5">
      <div className="text-center">
        <div className="spinner-border text-primary mb-3" role="status">
          <span className="visually-hidden">{text}</span>
        </div>
        <p className="text-muted">{text}</p>
      </div>
    </div>
  );
}