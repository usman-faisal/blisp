// @ts-check
import tailwind from '@astrojs/tailwind';
import { defineConfig } from 'astro/config';

import icon from 'astro-icon';

import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [tailwind(), icon(), sitemap()]
});