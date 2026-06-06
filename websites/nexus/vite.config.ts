import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Project Pages are served from https://<org>.github.io/<repo>/, so assets need that sub-path as base. A custom
// domain (CNAME) serves from root — set VITE_BASE='/' in that case.
const base = process.env.VITE_BASE ?? '/plitzi-workspace/';

// By default the site dogfoods the store straight from source for instant feedback. The deploy CI sets
// VITE_USE_PUBLISHED=true to build the public demo against the latest npm release instead of the dev symlink.
const usePublished = process.env.VITE_USE_PUBLISHED === 'true';
const storeSrc = fileURLToPath(new URL('../../packages/nexus/src', import.meta.url));

export default defineConfig({
  base,
  resolve: {
    // nexus source lives outside this app, so without deduping it would import the workspace-root copy of React
    // while react-dom uses this app's copy — two React instances, null hooks. Force a single copy.
    dedupe: ['react', 'react-dom'],
    alias: usePublished
      ? []
      : [
          {
            find: /^@plitzi\/nexus\/createStore\/hooks\/useStore$/,
            replacement: `${storeSrc}/createStore/hooks/useStore.ts`
          },
          { find: /^@plitzi\/nexus\/history$/, replacement: `${storeSrc}/history/index.ts` },
          { find: /^@plitzi\/nexus$/, replacement: `${storeSrc}/index.ts` }
        ]
  },
  // The store source lives in the monorepo (../../packages/nexus/src); let the dev server read it.
  server: { fs: { allow: ['../..'] } },
  plugins: [react(), tailwindcss()]
});
