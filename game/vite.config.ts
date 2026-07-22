import { defineConfig } from 'vite';

// Vite configuration for the Phaser game client.
export default defineConfig({
  server: {
    port: 5173,
    // Proxy API calls to the backend during development.
    proxy: {
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
