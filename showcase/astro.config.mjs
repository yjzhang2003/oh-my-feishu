import { defineConfig } from 'astro/config';

const base = process.env.SITE_BASE || '/';
const site = process.env.SITE_URL || 'https://yjzhang2003.github.io';

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'always',
});
