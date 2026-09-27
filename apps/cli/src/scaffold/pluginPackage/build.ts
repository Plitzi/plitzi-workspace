import type { ProjectFiles } from '../types';

/**
 * The preview's Vite config — and only the preview's.
 *
 * Building the plugin is not this package's code: `plitzi pack plugin` does it, the one implementation every plugin is
 * built with, so the platform's contract (React and the SDK kept out, one file, a manifest with each file's hash) moves
 * with the CLI instead of going stale in a copy here.
 */

const viteConfig = (): string => `import { createReadStream } from 'node:fs';
import { createRequire } from 'node:module';

import { defineConfig } from 'vite';

import type { Plugin } from 'vite';

const require = createRequire(import.meta.url);

/**
 * Serves the dev tools' stylesheet at the path the SDK asks for.
 *
 * They render into a shadow root, which cannot see this page's styles, so they fetch a stylesheet of their own from
 * \`/plitzi-sdk-devtools.css\` — a path that exists on a server serving the SDK's assets and nowhere else. Development
 * only, and read from \`node_modules\` on each request, so it cannot go stale against the installed SDK.
 */
const devToolsStylesheet = (): Plugin => ({
  name: 'plitzi-devtools-stylesheet',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/plitzi-sdk-devtools.css', (_request, response) => {
      response.setHeader('Content-Type', 'text/css');
      createReadStream(require.resolve('@plitzi/plitzi-sdk/plitzi-sdk-devtools.css')).pipe(response);
    });
  }
});

/**
 * \`start\` serves the preview: \`index.html\`, every element inside a space. Packing the plugin is the CLI's
 * (\`plitzi pack plugin\`).
 *
 * The host is pinned because Vite binds \`localhost\` — IPv6 on most machines — while what waits for a dev server,
 * the visual test included, asks for 127.0.0.1.
 */
export default defineConfig({
  plugins: [devToolsStylesheet()],
  server: { host: '127.0.0.1', port: 5173 }
});
`;

export const buildFiles = (): ProjectFiles => ({
  'vite.config.ts': viteConfig()
});
