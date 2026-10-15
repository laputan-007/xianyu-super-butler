import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 开发模式代理：前端 axios 全部走相对路径，而后端路由大多挂在根路径
// （/login、/cookies…），无法用单一前缀区分，这里枚举全部后端路由前缀。
// dev 下新增后端路由若漏配，对应请求会 404/拿到 HTML，把前缀补进列表即可。
// 构建行为保持不变（base /static/，输出 ../static，由 FastAPI 托管）。
const BACKEND = process.env.VITE_BACKEND || 'http://127.0.0.1:8090';
const backendPrefixes = [
  'login', 'logout', 'register', 'verify', 'change-password',
  'generate-captcha', 'verify-captcha', 'send-verification-code',
  'registration-status', 'login-info-status', 'geetest', 'health',
  'admin', 'ai-reply-settings', 'ai-reply-test', 'analytics', 'announcements', 'auto-reply-logs',
  'risk-control-logs', 'blacklist', 'cards', 'chat', 'cookies', 'events',
  'default-replies', 'delivery-block-rules', 'delivery-rules',
  'item-delivery-configs', 'items', 'keywords-with-item-id', 'logs',
  'message-filters', 'message-notifications',
  'notification-channels', 'notification-events', 'product-automation',
  'qr-login', 'quick-phrases', 'system-settings', 'upload-image', 'usage-stats',
  'api', 'static',
];

export default defineConfig(({ command }) => ({
  // build 产物由后端托管在 /static/ 下；dev 独立端口直接挂在根路径
  base: command === 'build' ? '/static/' : '/',
  plugins: [react()],
  server: {
    port: 9999,
    proxy: {
      // 末尾的 [?/] 兜住带查询串的根级路由：vite6 用「路径+查询串」整体做正则匹配，
      // 如 /usage-stats?days=7 若只允许 (/|$) 会漏进 SPA 兜底返回 HTML
      [`^/(${backendPrefixes.join('|')})([/?]|$)`]: {
        target: BACKEND,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    outDir: process.env.VITE_OUT_DIR || '../static',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
    // static/ also contains uploads and backend-owned files.
    emptyOutDir: false,
  },
}));
