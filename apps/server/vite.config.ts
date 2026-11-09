/// <reference types="vite/client" />

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { transformSync } from 'esbuild';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const require = createRequire(import.meta.url);
const PACKAGE = require('./package.json') as {
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const baseUrl = new URL('.', import.meta.url);
const root = baseUrl.pathname;

/** Where the template module lands in the build: a chunk of its own, so its `views` can be copied beside it. */
const TEMPLATE_MODULE = 'src/modules/ssr/template.ts';

/**
 * The template and its scripts, copied beside the template's chunk (`dist/chunks/views`) — it reads them beside itself —
 * with the page's inline scripts minified: readable and commented in the source, a few hundred bytes on every page
 * instead of several KB. Top-level names are kept — the template's module script calls what one of them declares.
 */
const copyViews = (): import('vite').Plugin => ({
  name: 'copy-views',
  apply: 'build',
  closeBundle() {
    const views = path.resolve(root, 'dist/chunks/views');
    fs.cpSync(path.resolve(root, 'src/modules/ssr/views'), views, { recursive: true });
    const inline = path.join(views, 'inline');
    for (const name of fs.readdirSync(inline).filter(file => file.endsWith('.js'))) {
      const file = path.join(inline, name);
      const { code } = transformSync(fs.readFileSync(file, 'utf-8'), {
        minify: true,
        legalComments: 'none',
        target: 'esnext',
        charset: 'utf8'
      });
      fs.writeFileSync(file, code);
    }
  }
});

/** Skips rewriting a declaration whose content is already on disk. Every build regenerates every `.d.ts`, unchanged
 *  ones included, and replacing hundreds of files at once is what makes the editors holding them open fall over.
 *  Inlined rather than shared: a vite config importing across packages breaks `composite` type-checking (TS6059). */
const skipUnchangedDts = (filePath: string, content: string) => {
  try {
    if (fs.readFileSync(filePath, 'utf8') === content) {
      return false as const;
    }
  } catch {
    // Not there yet — first build, or a new module. Write it.
  }

  return undefined;
};

export default defineConfig(({ mode }) => {
  const devMode = mode !== 'production';

  return {
    plugins: [
      react(),
      dts({
        include: ['src', 'package.json'],
        entryRoot: 'src',
        // `views/inline` holds scripts written into the page as text: nothing imports them, and they have no types.
        exclude: ['**/*.(test|bench).(ts|tsx)', '**/tests/**', 'src/modules/ssr/views/inline/**'],
        tsconfigPath: './tsconfig.app.json',
        // The declarations are written against the other packages' declarations, as a consumer reads them.
        compilerOptions: { customConditions: [] },
        beforeWriteFile: skipUnchangedDts
      }),
      copyViews()
    ],
    define: {
      // No `process.env.NODE_ENV`: a server reads it from the process it runs in. Baked in, the published build always
      // believed it ran in production, whatever the deployment set — the build React renders with is the process's.
      VERSION: JSON.stringify(PACKAGE.version)
    },
    build: {
      // Keep the previous output in place during development so `beforeWriteFile` has something to compare against:
      // wiping dist means every declaration is written afresh, and the editors holding them open re-parse the lot.
      emptyOutDir: !devMode,
      lib: {
        entry: {
          index: path.resolve(root, 'src/index.ts'),
          auth: path.resolve(root, 'src/auth.ts'),
          // OAuth 2.1 authorization. Its own entry because it is mounted more than once with different adapters —
          // the MCP connector grants a space token, a native client grants a session — and a server that mounts
          // neither should not carry the protocol to find that out.
          oauth: path.resolve(root, 'src/oauth.ts'),
          ssr: path.resolve(root, 'src/ssr.ts'),
          // Pages and actions in one process (`createPlatform`): a page server deployed on its own never loads the engine.
          platform: path.resolve(root, 'src/platform.ts'),
          // Which space a request is for, and the pages replicas share: what a process that serves no pages uses of
          // them, without the renderer (a worker resolves spaces and invalidates pages, and rendered nothing to do it).
          spaces: path.resolve(root, 'src/spaces.ts'),
          cache: path.resolve(root, 'src/cache.ts'),
          // The server of a project `@plitzi/cli` writes, wired from where the project keeps each part: its own entry, so
          // a server that is not such a project never loads what reads that layout or re-authors a space on a save.
          project: path.resolve(root, 'src/project.ts'),
          // A project's server bundled for production, the step its `build` runs: a server that only serves never loads it.
          bundle: path.resolve(root, 'src/bundle.ts'),
          // What `start:dev` of such a project preloads: its `.env`, read where Node's own flag would make the watcher
          // restart on every write in the project. A side effect and nothing else, so it is an entry of its own.
          env: path.resolve(root, 'src/env.ts'),
          // Ready-made request handlers for the auth flows. Depends on no framework — see src/handlers.ts —
          // but keeping it out of the barrels is what makes it opt-in rather than something a page server drags in.
          handlers: path.resolve(root, 'src/handlers.ts')
        },
        formats: ['es']
      },
      rollupOptions: {
        external: id => {
          if (id.startsWith('node:') || id.startsWith('node/')) {
            return true;
          }

          if (id === 'react' || id === 'react-dom' || id.startsWith('react-dom/') || id.startsWith('react/')) {
            return true;
          }

          if (!id.startsWith('.') && !id.startsWith('/')) {
            return true;
          }

          return false;
        },
        // One file per entry and the code they share in a few chunks, rather than a file per module: Node resolves,
        // loads and links each module it imports, and the page server's 225 files of this package were most of its
        // start — measured, the whole server bundled started in a quarter of the time.
        output: {
          format: 'es',
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name]-[hash].js',
          // What renders nothing — the helpers (caches, routes, defaults) and the space adapters — kept apart from the
          // renderer: grouped with it, a process that only resolves spaces or invalidates pages (a worker) loaded React
          // and the SDK with them, most of what it held at rest.
          manualChunks: id =>
            id.endsWith(TEMPLATE_MODULE)
              ? 'template'
              : id.includes('/src/helpers/') || id.includes('/src/adapters/') || id.endsWith('/redisPageStore.ts')
                ? 'core'
                : undefined
        }
      },
      target: 'node20',
      ssr: true,
      minify: false
    }
  };
});
