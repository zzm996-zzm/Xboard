import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/assets/admin-ops/',
  plugins: [react()],
  build: {
    outDir: '../../public/assets/admin-ops',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:7001',
        changeOrigin: true
      }
    }
  }
});
