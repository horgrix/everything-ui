import { NavLink } from 'react-router-dom';
import VisitStats from './VisitStats';
import usePageviewTracking from '../../hooks/usePageviewTracking';
import { isAuthEnabled, signOut } from '../../api/auth';

export default function Navbar() {
  usePageviewTracking();

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark sticky-top">
      <div className="container-fluid">
        <div className="d-flex align-items-center gap-lg-3 gap-2">
          <NavLink className="navbar-brand fw-bold mb-0 me-0" to="/">
            <i className="bi bi-graph-up me-2"></i>
            数据可视化平台
          </NavLink>
          {/* 本周 PV / UV —— 接口未就绪时自动不渲染 */}
          <VisitStats />
        </div>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="切换导航"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarNav">
          {/* One Search 首页（搜索框 + 榜单）不再进导航：入口在首页榜单行（直达 SearchView），
              `/one-search` 与 `/one-search/report?q=` 仍可按 URL 访问 */}
          <ul className="navbar-nav ms-auto">
            <li className="nav-item">
              <NavLink
                to="/home"
                className={({ isActive }) =>
                  `nav-link text-nowrap ${isActive ? 'active' : ''}`
                }
              >
                <i className="bi bi-house-door me-1"></i>
                首页
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink
                to="/business"
                className={({ isActive }) =>
                  `nav-link text-nowrap ${isActive ? 'active' : ''}`
                }
              >
                <i className="bi bi-bar-chart me-1"></i>
                Games报表
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink
                to="/taptap"
                className={({ isActive }) =>
                  `nav-link text-nowrap ${isActive ? 'active' : ''}`
                }
              >
                <i className="bi bi-controller me-1"></i>
                TapTap报表
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink
                to="/taprep-monthly"
                className={({ isActive }) =>
                  `nav-link text-nowrap ${isActive ? 'active' : ''}`
                }
              >
                <i className="bi bi-calendar3 me-1"></i>
                TapREP月报
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink
                to="/periodic-report"
                className={({ isActive }) =>
                  `nav-link text-nowrap ${isActive ? 'active' : ''}`
                }
                title="定期报告（周报 / 月报 / 年报）"
              >
                <i className="bi bi-file-earmark-text me-1"></i>
                定期报告
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink
                to="/finance"
                className={({ isActive }) =>
                  `nav-link text-nowrap ${isActive ? 'active' : ''}`
                }
              >
                <i className="bi bi-cash-stack me-1"></i>
                财务信息
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink
                to="/quant"
                className={({ isActive }) =>
                  `nav-link text-nowrap ${isActive ? 'active' : ''}`
                }
              >
                <i className="bi bi-calculator me-1"></i>
                量化信息
              </NavLink>
            </li>
            {/* 退出登录：仅在网关 SSO 开启时出现；点后由 oauth2-proxy 清 Cookie 并跳回首页 */}
            {isAuthEnabled() && (
              <li className="nav-item">
                <button
                  type="button"
                  className="nav-link btn btn-link border-0 bg-transparent"
                  title="退出登录"
                  onClick={signOut}
                >
                  <i className="bi bi-box-arrow-right me-1"></i>
                  退出
                </button>
              </li>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}