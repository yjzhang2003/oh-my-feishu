import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

const base = process.env.SITE_BASE || '/';
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
const site = process.env.SITE_URL || (vercelHost ? `https://${vercelHost}` : 'http://localhost:4321');

export default defineConfig({
  site,
  base,
  output: 'static',
  adapter: vercel(),
  trailingSlash: 'ignore',
});
