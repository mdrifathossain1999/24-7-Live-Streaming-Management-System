module.exports = {
  apps: [
    {
      name: "streaming-system-24-7",
      script: "./dist/server.cjs",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        JWT_SECRET: "streaming-manager-secret-superkey-2026"
      }
    }
  ]
};
