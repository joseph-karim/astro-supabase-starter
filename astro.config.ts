import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import node from '@astrojs/node';
import tailwindcss from "@tailwindcss/vite";
import react from '@astrojs/react';

const isRender = Boolean(
  process.env.RENDER ||
  process.env.RENDER_SERVICE_ID ||
  process.env.RENDER_EXTERNAL_URL
);
const deployTarget = process.env.DEPLOY_TARGET || (isRender ? 'render' : 'netlify');

export default defineConfig({
  integrations: [react()],
  markdown: {
    shikiConfig: {
      theme: 'github-light-high-contrast',
    },
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: ['.netlify.app']
    }
  },
  adapter: deployTarget === 'render' ? node({ mode: 'standalone' }) : netlify()
});
