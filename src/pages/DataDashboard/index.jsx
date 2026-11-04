import { useMemo } from 'react';
import Loading from '../../components/common/Loading';
import useStaticJson, { useRefreshAll } from './useStaticJson';
import { MANIFEST_FILE } from './constants';
import { DistributionBlock, EmptyHint, KpiBlock, RankBlock, TableBlock, TrendBlock } from './blocks';

const BLOCK_RENDERERS = {
  kpi: KpiBlock,
  trend: TrendBlock,
  rank: RankBlock,
  distribution: DistributionBlock,
  table: TableBlock,
};

function formatStamp(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('zh-CN', { hour12: false });
}

/** 单个区块：自己取自己的 JSON，一个区块挂了不影响其它区块 */
function BlockCard({ block, bust }) {
  const { data, loading, error, mock } = useStaticJson(block.source, { enabled: Boolean(block.source), bust });
  const Renderer = BLOCK_RENDERERS[block.type] ?? TableBlock;
  const span = Number(block.span) || 12;

  return (
    <div className={span >= 12 ? 'col-12' : `col-12 col-xl-${span}`}>
      <section className="card border-0 shadow-sm h-100">
        <div className="card-header bg-white d-flex align-items-center justify-content-between border-0 pt-3">
          <div className="d-flex align-items-center gap-2">
            <h2 className="h6 mb-0 fw-semibold">{block.title || block.id}</h2>
            {mock && <span className="badge text-bg-warning fw-normal">示例</span>}
          </div>
          {block.note && <span className="text-secondary small">{block.note}</span>}
        </div>
        <div className="card-body pt-2">
          {loading && <Loading text="加载中..." />}
          {!loading && error && (
            <EmptyHint text={`数据未就绪（${block.source}：${error}）`} />
          )}
          {!loading && !error && <Renderer data={data} height={block.height} maxRows={block.maxRows} />}
        </div>
      </section>
    </div>
  );
}

export default function DataDashboard() {
  const [bust, refresh] = useRefreshAll();
  const { data: manifest, loading, error, mock } = useStaticJson(MANIFEST_FILE, { bust });

  const blocks = useMemo(() => (Array.isArray(manifest?.blocks) ? manifest.blocks : []), [manifest]);

  return (
    <div className="container-fluid py-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h1 className="h4 mb-1 fw-bold">
            <i className="bi bi-speedometer2 me-2" />
            {manifest?.title || '数据大盘'}
          </h1>
          <div className="text-secondary small">
            {manifest?.subtitle || '全站核心指标总览'}
            {manifest?.period && <span className="badge text-bg-light border ms-2 fw-normal">{manifest.period}</span>}
          </div>
        </div>
        <div className="d-flex align-items-center gap-3">
          <span className="text-secondary small">
            <i className="bi bi-clock-history me-1" />
            数据时间 {formatStamp(manifest?.updatedAt)}
          </span>
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={refresh} disabled={loading}>
            <i className={`bi bi-arrow-clockwise me-1 ${loading ? 'spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      {mock && (
        <div className="alert alert-warning py-2 small" role="alert">
          <i className="bi bi-exclamation-triangle me-1" />
          当前展示的是本地示例数据：静态 JSON 通道还没就绪，数值不可用于判断业务。
        </div>
      )}

      {loading && !blocks.length && <Loading text="正在读取大盘目录..." />}

      {!loading && error && (
        <div className="alert alert-secondary" role="alert">
          <div className="fw-semibold mb-1">大盘目录不可用</div>
          <div className="small">
            读取 <code>{MANIFEST_FILE}</code> 失败：{error}。需要运维把静态 JSON 同步到
            <code className="mx-1">/_api/dashboard/</code>，目录结构见页面目录下的 README。
          </div>
        </div>
      )}

      {!loading && !error && !blocks.length && <EmptyHint text="目录里没有配置任何区块" />}

      {!!blocks.length && (
        <div className="row g-3">
          {blocks.map((block) => (
            <BlockCard key={block.id} block={block} bust={bust} />
          ))}
        </div>
      )}
    </div>
  );
}
