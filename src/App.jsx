import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import ErrorBoundary from './components/common/ErrorBoundary';
import BusinessReport from './pages/BusinessReport';
import FinanceInfo from './pages/FinanceInfo';
import QuantInfo from './pages/QuantInfo';

export default function App() {
  return (
    <BrowserRouter>
      <div className="d-flex flex-column min-vh-100">
        <Navbar />
        <main className="flex-grow-1 bg-light">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Navigate to="/business" replace />} />
              <Route path="/business" element={<BusinessReport />} />
              <Route path="/finance" element={<FinanceInfo />} />
              <Route path="/quant" element={<QuantInfo />} />
            </Routes>
          </ErrorBoundary>
        </main>
        <footer className="bg-dark text-white text-center py-3 small">
          <span>&copy; {new Date().getFullYear()} 数据可视化平台 — Powered by React + ApexCharts</span>
        </footer>
      </div>
    </BrowserRouter>
  );
}