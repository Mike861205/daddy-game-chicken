import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import sharp from 'sharp';

const gameRoot = fileURLToPath(new URL('.', import.meta.url));
const pwaIconDirectory = resolve(gameRoot, 'public/assets/icons');
const pwaIconSource = resolve(pwaIconDirectory, 'daddy-pollo-pwa.png');
const pwaVersion =
  process.env.PWA_VERSION ??
  `local-${new Date().toISOString().replace(/\D/gu, '').slice(0, 14)}`;

async function generatePwaIcons(): Promise<void> {
  await Promise.all(
    [192, 512].map((size) =>
      sharp(pwaIconSource)
        .resize(size, size, { fit: 'cover', position: 'centre' })
        .png()
        .toFile(resolve(pwaIconDirectory, `daddy-pollo-pwa-${size}.png`)),
    ),
  );
}

// Vite configuration for the Phaser game client.
export default defineConfig({
  define: {
    __PWA_VERSION__: JSON.stringify(pwaVersion),
  },
  plugins: [
    {
      name: 'daddy-pollo-pwa-icons',
      async config() {
        await generatePwaIcons();
      },
      async buildStart() {
        await generatePwaIcons();
      },
      async configureServer(server) {
        await generatePwaIcons();
        server.watcher.add(pwaIconSource);
        server.watcher.on('change', async (changedPath) => {
          if (resolve(changedPath) === pwaIconSource) {
            await generatePwaIcons();
          }
        });
      },
    },
    {
      name: 'superadmin-trailing-slash',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/superadmin') {
            res.statusCode = 308;
            res.setHeader('Location', '/superadmin/');
            res.end();
            return;
          }
          next();
        });
      },
    },
  ],
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
