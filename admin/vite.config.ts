import { defineConfig } from 'vite';

export default defineConfig({
  base: '/superadmin/',
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist/superadmin',
    sourcemap: false,
  },
});
