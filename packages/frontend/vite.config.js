import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';

const urls = {
  local: 'http://localhost:3001',
  prod1: 'http://www.dolmo.top:3001',
  prod2: 'http://scj.dolmo.top:3001',
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools()],
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
});
