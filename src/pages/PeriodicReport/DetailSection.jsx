import { useState } from 'react';

/**
 * 详情页分区（可折叠）
 * 结构：H2 标题栏 + 可折叠内容区；内容由调用方通过 children 自行排版。
 * 不传 children 时显示「内容待排版」占位。
 */
export default function DetailSection({ title, defaultOpen = true, children = null }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="pr-card pr-section" data-open={open}>
      <button
        type="button"
        className="pr-section__head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <h2 className="pr-section__title">{title}</h2>
        <i className={`bi ${open ? 'bi-chevron-up' : 'bi-chevron-down'} pr-section__chevron`} aria-hidden="true"></i>
      </button>

      <div className="pr-section__collapse" data-open={open}>
        <div className="pr-section__inner">
          <div className="pr-section__body">
            {children ?? (
              <div className="pr-section__placeholder">
                <i className="bi bi-layout-text-window-reverse"></i>
                <span>内容待排版</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
