import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Project Pages are served from https://<org>.github.io/<repo>/, so assets need that sub-path as base. A custom
// domain (CNAME) serves from root — set VITE_BASE='/' in that case.
const base = process.env.VITE_BASE ?? '/plitzi-workspace/';

// The site dogfoods the store straight from source — the live demos always reflect every feature in the repo (path
// subscriptions, scoped stores, time-travel) with no npm round-trip.
const storeSrc = fileURLToPath(new URL('../../packages/sdk-store/src', import.meta.url));

export default defineConfig({
  base,
  resolve: {
    alias: [
      { find: /^@plitzi\/sdk-store\/history$/, replacement: `${storeSrc}/history/index.ts` },
      { find: /^@plitzi\/sdk-store$/, replacement: `${storeSrc}/index.ts` }
    ]
  },
  // The store source lives in the monorepo (../../packages/sdk-store/src); let the dev server read it.
  server: { fs: { allow: ['../..'] } },
  plugins: [react(), tailwindcss()]
});
