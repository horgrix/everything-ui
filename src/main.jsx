import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { isAuthEnabled, checkSession, redirectToSignIn } from './api/auth';
import './styles/index.scss';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

// 会话兜底：只在 SSO 开启时、每个页面加载查一次 /oauth2/auth（不是每个路由都查）。
// 网关正常挡在 HTML 之前，这里几乎总是 200；用于兜住「页面开着但 Cookie 过期」。
// 探测失败一律放行，绝不因为探测本身把用户挡在门外。
if (isAuthEnabled()) {
  checkSession().then(({ authenticated }) => {
    if (!authenticated) redirectToSignIn();
  });
}

createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);