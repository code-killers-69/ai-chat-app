import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import { compression } from 'vite-plugin-compression2';

const urls = {
  local: 'http://localhost:3001',
  prod1: 'http://www.dolmo.top:3001',
  prod2: 'http://scj.dolmo.top:3001',
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    mode === 'development' && vueDevTools(),
    // 生产构建：gzip 预压缩
    mode === 'production' && compression({
      algorithm: 'gzip',
      threshold: 1024,
    }),
    // 生产构建：brotli 预压缩（比 gzip 压缩率高 15-20%）
    mode === 'production' && compression({
      algorithm: 'brotliCompress',
      threshold: 1024,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: urls.local,
        changeOrigin: true,
      },
    },
  },
  build: {
    // 目标浏览器
    target: 'es2020',
    // 手动分包：vendor 独立缓存
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vue': ['vue'],
          'vendor-marked': ['marked'],
        },
      },
    },
    // 显示 gzip 压缩大小
    reportCompressedSize: true,
    // chunk 大小警告阈值
    chunkSizeWarningLimit: 500,
  },
}));
