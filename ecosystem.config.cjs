// PM2 process configuration for the Daddy Game Chicken API.
// Usage: pm2 start ecosystem.config.cjs --env production
module.exports = {
  apps: [
    {
      name: 'daddy-game-chicken-api',
      cwd: './server',
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
      // Logs are handled by PM2; timestamps enabled.
      time: true,
    },
  ],
};
