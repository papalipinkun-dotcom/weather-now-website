import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Website port. Defaults to 5173; override with WEB_PORT.
// (PORT is only used by the API server, so the two never clash.)
const port = Number(process.env.WEB_PORT ?? 5173);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid WEB_PORT value: "${process.env.WEB_PORT}"`);
}

// URL prefix the site is served from. "/" is right for local use.
const basePath = process.env.BASE_PATH ?? '/';

// The website calls /api/..., which is forwarded to the API server
// (backend/api-server). Override its port with API_PORT.
const apiProxy = {
  '/api': {
    target: `http://127.0.0.1:${process.env.API_PORT ?? 8080}`,
    changeOrigin: true,
  },
};

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: false,
    host: 'localhost',
    proxy: apiProxy,
  },
  preview: {
    port,
    strictPort: false,
    host: 'localhost',
    proxy: apiProxy,
  },
});
