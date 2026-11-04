import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // 第三方库单独成 chunk：与业务代码分开缓存，改业务代码不用重下图表库。
        // 注意：不要把 apexcharts 放进 manualChunks —— 它由 ChartWrapper 动态 import，
        // 一旦被提成共享 chunk，rolldown 会把它写进 index.html 的 modulepreload，
        // 等于又把 219KB(gzip) 拉回首屏关键路径。交给动态 import 自然分块。
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler') || id.includes('react-router')) return 'vendor-react'
          if (id.includes('bootstrap')) return 'vendor-bootstrap'
          if (id.includes('@tanstack') || id.includes('axios')) return 'vendor-data'
        },
      },
    },
  },
  server: {
    proxy: {
      '/api/data': {
        target: 'https://horgrix.com',
        changeOrigin: true,
        secure: true,
      },
      '/api/stats': {
        target: 'https://horgrix.com',
        changeOrigin: true,
        secure: true,
        // 本地调试的每次页面浏览不走线上统计（后端识别 X-No-Track 后直接丢弃）
        headers: { 'X-No-Track': '1' },
      },
      '/api/v2': {
        target: 'https://api.horgrix.com',
        changeOrigin: true,
        secure: true,
      },
      // 下面两个只在把 baseURL 改成同源相对路径（如 /api/v09/data、/api/v1）时才会用到
      '/api/v09': {
        target: 'https://api.horgrix.com',
        changeOrigin: true,
        secure: true,
      },
      '/api/v1': {
        target: 'https://api.horgrix.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
