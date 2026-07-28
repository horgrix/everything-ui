import { NavLink } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark sticky-top">
      <div className="container-fluid">
        <NavLink className="navbar-brand fw-bold" to="/">
          <i className="bi bi-graph-up me-2"></i>
          数据可视化平台
        </NavLink>

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
          <ul className="navbar-nav ms-auto">
            <li className="nav-item">
              <NavLink
                to="/business"
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'active' : ''}`
                }
              >
                <i className="bi bi-bar-chart me-1"></i>
                业务报表
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink
                to="/finance"
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'active' : ''}`
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
                  `nav-link ${isActive ? 'active' : ''}`
                }
              >
                <i className="bi bi-calculator me-1"></i>
                量化信息
              </NavLink>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}