import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import ErrorBoundary from './components/common/ErrorBoundary';

/* 路由级代码分割：每个页面单独 chunk，/taptap 首屏不再下载全站代码 */
const Home = lazy(() => import('./pages/Home'));
const BusinessReport = lazy(() => import('./pages/BusinessReport'));
const OneSearch = lazy(() => import('./pages/OneSearch'));
const SearchView = lazy(() => import('./pages/OneSearch/SearchView'));
const FinanceInfo = lazy(() => import('./pages/FinanceInfo'));
const QuantInfo = lazy(() => import('./pages/QuantInfo'));
const TapTapReport = lazy(() => import('./pages/TapTapReport'));
const TapRepMonthly = lazy(() => import('./pages/TapRepMonthly'));
const PeriodicReport = lazy(() => import('./pages/PeriodicReport'));
const PeriodicReportDetail = lazy(() => import('./pages/PeriodicReport/DetailView'));

function RouteFallback() {
  return (
    <div className="d-flex align-items-center justify-content-center py-5 text-muted small">
      加载中…
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="d-flex flex-column min-vh-100">
        <Navbar />
        <main className="flex-grow-1 bg-light">
          <ErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="/home" element={<Home />} />
                <Route path="/business" element={<BusinessReport />} />
                <Route path="/one-search" element={<OneSearch />} />
                <Route path="/one-search/report" element={<SearchView />} />
                <Route path="/taptap" element={<TapTapReport />} />
                <Route path="/taprep-monthly" element={<TapRepMonthly />} />
                <Route path="/periodic-report" element={<PeriodicReport />} />
                <Route path="/periodic-report/detail" element={<PeriodicReportDetail />} />
                <Route path="/finance" element={<FinanceInfo />} />
                <Route path="/quant" element={<QuantInfo />} />
                {/* 已下线的旧路径（含数据大盘 /dashboard）统一回首页，避免书签打开空白 */}
                <Route path="*" element={<Navigate to="/home" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
        <footer className="bg-dark text-white text-center py-3 small">
          <span>&copy; {new Date().getFullYear()} 数据可视化平台 — Powered by React + ApexCharts</span>
        </footer>
      </div>
    </BrowserRouter>
  );
}
