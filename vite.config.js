import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
      // 数据大盘的静态 JSON（生产是同源静态目录 /_api/，dev 回落到线上源）
      '/_api': {
        target: 'https://horgrix.com',
        changeOrigin: true,
        secure: true,
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