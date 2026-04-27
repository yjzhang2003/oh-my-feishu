module.exports = {
  apps: [{
    name: 'oh-my-feishu',
    script: 'npx',
    args: 'tsx src/start.ts',
    cwd: __dirname,
    interpreter: 'none',
    env: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info',
    },
    env_development: {
      NODE_ENV: 'development',
      LOG_LEVEL: 'debug',
    },
    // Auto restart on crash
    autorestart: true,
    max_restarts: 5,
    min_uptime: '10s',
    // Log configuration
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true,
    time: true,
  }]
};
