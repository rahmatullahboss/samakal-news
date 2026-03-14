// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    imageService: 'cloudflare',
    platformProxy: {
      enabled: true,
    },
  }),
  integrations: [react()],
  image: {
    remotePatterns: [{ protocol: 'https' }],
  },
  vite: {
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  },
});