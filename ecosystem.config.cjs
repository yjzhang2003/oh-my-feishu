const { existsSync } = require('fs');
const { homedir } = require('os');
const { join } = require('path');

const packageRoot = __dirname;
const distEntry = join(packageRoot, 'dist', 'start.js');
const srcEntry = join(packageRoot, 'src', 'start.ts');
const usesPublishedEntry = existsSync(distEntry);
const dataRoot = packageRoot.includes('node_modules')
  ? join(homedir(), '.oh-my-feishu')
  : packageRoot;

module.exports = {
  apps: [{
    name: 'oh-my-feishu',
    ...(usesPublishedEntry
      ? { script: distEntry }
      : { script: 'npx', args: `tsx ${srcEntry}`, interpreter: 'none' }),
    cwd: packageRoot,
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
    error_file: join(dataRoot, 'logs', 'pm2-error.log'),
    out_file: join(dataRoot, 'logs', 'pm2-out.log'),
    merge_logs: true,
    time: true,
  }]
};
