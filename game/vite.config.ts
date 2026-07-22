import { defineConfig } from 'vite';

// Vite configuration for the Phaser game client.
export default defineConfig({
  server: {
    port: 5173,
    // Proxy API calls to the backend during development.
    proxy: {
      '/superadmin': {
        target: 'http://localhost:5174',
        changeOrigin: true,
        ws: true,
      },
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 4096,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
});
