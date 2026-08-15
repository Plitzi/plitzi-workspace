/// <reference types="vite/client" />
/// <reference types="vitest" />

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import ejs from 'ejs';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import viteCompression from 'vite-plugin-compression';
import dts from 'vite-plugin-dts';
import { ViteEjsPlugin } from 'vite-plugin-ejs';
import mkcert from 'vite-plugin-mkcert';

import type { Plugin } from 'vite';

const require = createRequire(import.meta.url);
const PACKAGE = require('./package.json') as {
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const baseUrl = new URL('.', import.meta.url);

const packages = {
  '@plitzi/sdk-auth': path.resolve(baseUrl.pathname, '../../packages/sdk-auth/src'),
  '@plitzi/sdk-dev-tools': path.resolve(baseUrl.pathname, '../../packages/sdk-dev-tools/src'),
  '@plitzi/sdk-elements': path.resolve(baseUrl.pathname, '../../packages/sdk-elements/src'),
  '@plitzi/sdk-event-bridge': path.resolve(baseUrl.pathname, '../../packages/sdk-event-bridge/src'),
  '@plitzi/sdk-interactions': path.resolve(baseUrl.pathname, '../../packages/sdk-interactions/src'),
  '@plitzi/sdk-navigation': path.resolve(baseUrl.pathname, '../../packages/sdk-navigation/src'),
  '@plitzi/sdk-plugins': path.resolve(baseUrl.pathname, '../../packages/sdk-plugins/src'),
  '@plitzi/sdk-schema': path.resolve(baseUrl.pathname, '../../packages/sdk-schema/src'),
  '@plitzi/sdk-shared': path.resolve(baseUrl.pathname, '../../packages/sdk-shared/src'),
  '@plitzi/sdk-style': path.resolve(baseUrl.pathname, '../../packages/sdk-style/src'),
  '@plitzi/sdk-variables': path.resolve(baseUrl.pathname, '../../packages/sdk-variables/src'),
  react: path.resolve(baseUrl.pathname, '../../node_modules/react'),
  'react-dom': path.resolve(baseUrl.pathname, '../../node_modules/react-dom')
};

// const importedPackages = new Set();

/** The credentials and endpoints `index.html` boots with, overridable from the environment.
 *
 *  They used to be literals in the template, pasted from `yarn token` and expiring a day later — fine to do by
 *  hand, impossible for anything automated to depend on. Set nothing and the values are exactly the ones that
 *  were always there.
 *
 *  Defined once because TWO renderers use the template: the dev server's EJS plugin and the build's own
 *  `generateBundle`. EJS throws on a variable it was not given, so a list that lives in one of them and not the
 *  other is a build that fails while the dev server is perfectly happy. */
const bootstrap = () => ({
  webKey: process.env.PLITZI_WEB_KEY ?? '',
  userKey: process.env.PLITZI_USER_KEY ?? '',
  apiServer: process.env.PLITZI_API_SERVER ?? 'https://api.plitzi.local',
  ssrServer: process.env.PLITZI_SSR_SERVER ?? 'https://ssr.plitzi.local',
  serverUrl: process.env.PLITZI_SERVER_URL ?? 'https://server.plitzi.local',
  websocketServer: process.env.PLITZI_WS_SERVER ?? 'wss://server.plitzi.local',
  subscriptionServer: process.env.PLITZI_SUBSCRIPTION_SERVER ?? 'wss://server.plitzi.local/subscriptions'
});

function ejsPlugin(devMode?: boolean): Plugin {
  return {
    name: 'vite-plugin-ejs-index',

    generateBundle() {
      const templatePath = path.resolve(import.meta.dirname, './index.html');
      if (fs.existsSync(templatePath)) {
        const template = fs.readFileSync(templatePath, 'utf-8');
        const html = ejs.render(
          template,
          {
            ...bootstrap(),
            title: 'Plitzi SDK Builder',
            jsPath: '/plitzi-builder.js',
            cssPath: '/plitzi-builder.css',
            react: devMode ? '/plitzi-builder-dev-vendor.js' : '/plitzi-builder-vendor.js',
            reactJsx: devMode ? '/plitzi-builder-dev-vendor.js' : '/plitzi-builder-vendor.js',
            reactDom: devMode ? '/plitzi-builder-dev-vendor.js' : '/plitzi-builder-vendor.js',
            reactDomClient: devMode ? '/plitzi-builder-dev-vendor.js' : '/plitzi-builder-vendor.js',
            version: PACKAGE.version
          },
          { async: false }
        );
        this.emitFile({ type: 'asset', fileName: 'index.html', source: html });
      }
    }
  };
}

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

export default defineConfig(({ mode, command }) => {
  const devMode = mode !== 'production';
  const onlyAnalyze = !!process.env.ONLY_ANALYZE;
  const onlyGzip = !!process.env.ONLY_GZIP;
  const isWatch = process.argv.includes('--watch');
  /** The browser suite runs this app on plain HTTP, on a port of its own: a CI runner has no `app.plitzi.local`
   *  in its hosts file and no locally-trusted certificate authority, and minting one per run to talk to a mocked
   *  backend would be ceremony for nothing. Unset — which is every normal `yarn start` — nothing changes. */
  const plainHttp = !!process.env.PLITZI_BUILDER_HTTP;
  // const isSSR = process.argv.includes('--ssr');

  return {
    plugins: [
      !plainHttp && mkcert(),
      react(),
      ViteEjsPlugin({
        ...bootstrap(),
        title: 'Plitzi SDK Builder',
        description: '',
        jsPath: devMode ? '/src/index.tsx' : '/plitzi-builder.js',
        cssPath: '/plitzi-builder.css',
        react: devMode ? '/src/vendor-entry.ts' : '/plitzi-builder-vendor.js',
        reactJsx: devMode ? '/src/vendor-entry.ts' : '/plitzi-builder-vendor.js',
        reactDom: devMode ? '/src/vendor-entry.ts' : '/plitzi-builder-vendor.js',
        reactDomClient: devMode ? '/src/vendor-entry.ts' : '/plitzi-builder-vendor.js',
        version: PACKAGE.version
      }),
      command === 'build' && ejsPlugin(devMode),
      !isWatch &&
        viteCompression({ algorithm: 'gzip', deleteOriginFile: onlyGzip, filter: /plitzi-builder.(js|css)$/ }),
      dts({
        entryRoot: 'src',
        outDir: 'dist',
        rollupTypes: false,
        exclude: ['**/*.test.tsx', '**/*.stories.ts', '**/*.stories.tsx', 'vite.config.ts', 'setupTests.ts'],
        tsconfigPath: './tsconfig.app.json',
        beforeWriteFile: skipUnchangedDts
      }),
      // {
      //   name: 'debug-resolve',
      //   resolveId(/* source, importer */) {
      //     // console.log(`[VITE RESOLVE] Trying to resolve: ${source} from ${importer}`);
      //     return null; // Allow vite keep resolving
      //   }
      // },
      // {
      //   name: 'externalize-and-log',
      //   enforce: 'pre',
      //   resolveId(source, importer) {
      //     if (!importer || command === 'serve') {
      //       // Ignore main entries or runtime
      //       return null;
      //     }

      //     // Mark as external modules or sub-modules from node_modules
      //     if (!source.startsWith('.') && !path.isAbsolute(source)) {
      //       importedPackages.add(source);

      //       return { id: source, external: true };
      //     }

      //     return null;
      //   },
      //   buildEnd() {
      //     if (mode === 'development' && importedPackages.size > 0) {
      //       console.log('Packages imported:', Array.from(importedPackages));
      //     }
      //   }
      // }
      onlyAnalyze && visualizer({ filename: './dist/stats.html', open: true })
    ],
    optimizeDeps: {
      include: [
        'style-to-js',
        'debug',
        'extend',
        'lowlight',
        'lowlight/lib/core',
        'lowlight/lib/core',
        '@babel/runtime/regenerator'
      ]
    },
    css: {
      preprocessorOptions: {
        scss: {
          quietDeps: true
        }
      }
    },
    server: {
      host: plainHttp ? '127.0.0.1' : 'app.plitzi.local',
      port: Number(process.env.PLITZI_BUILDER_PORT ?? 3000),
      open: false
    },
    resolve: {
      alias: {
        // react: path.resolve(import.meta.dirname, '../../node_modules/react'),
        // 'react/jsx-runtime': path.resolve(import.meta.dirname, '../../node_modules/react'),
        // 'react-dom': path.resolve(import.meta.dirname, '../../node_modules/react-dom'),
        // 'react-dom/client': path.resolve(import.meta.dirname, '../../node_modules/react-dom'),
        '@pmodules': path.resolve('./src/modules'),
        '@pcomponents': path.resolve('./src/components'),
        'decode-named-character-reference': path.resolve(
          import.meta.dirname,
          '../../node_modules/decode-named-character-reference/index.js'
        ),
        // these 2 are used due zustand depending on use-sync-external-store and it is only CJS (xyflow depends on zustand)
        'use-sync-external-store/shim/with-selector.js': path.resolve(
          './src/patches/useSyncExternalStoreWithSelector.ts'
        ),
        'use-sync-external-store/shim': 'react',
        ...(devMode ? packages : {})
      },
      extensions: ['.js', '.mjs', '.ts', '.tsx']
    },
    build: {
      outDir: 'dist',
      ssrEmitAssets: true,
      lib: {
        entry: ['./src/index.tsx']
      },
      rollupOptions: {
        treeshake: true,
        external: [
          'react',
          'react-dom',
          'react-dom/client',
          'react-dom/server',
          'react/jsx-runtime',
          'react/jsx-dev-runtime',
          'react/compiler-runtime',
          '@plitzi/plitzi-sdk'
        ],
        output: [
          {
            format: 'es',
            exports: 'named',
            manualChunks: undefined,
            inlineDynamicImports: true, // false if u want to have chunks !devMode,
            entryFileNames: 'plitzi-builder.js',
            globals: {
              react: 'React',
              'react-dom': 'ReactDOM',
              'react-dom/client': 'ReactDOM',
              'react/jsx-runtime': 'React',
              'react/jsx-dev-runtime': 'React'
            }
          }
        ]
      },
      minify: devMode ? false : 'terser', // usar terser para máxima compresión
      terserOptions: {
        compress: {
          drop_console: true, // elimina todos los console.log, console.warn, etc.
          drop_debugger: true, // elimina todos los debugger;
          passes: 2 // hace múltiples pasadas de optimización para limpiar más código muerto
        },
        mangle: {
          safari10: true // corrige bugs de Safari 10 en mangle
        },
        format: {
          comments: /(webpackIgnore:true|webpackIgnore: true|@vite-ignore)/, // elimina todos los comentarios
          beautify: false // elimina espacios y sangrías
        }
      },
      sourcemap: false,
      emptyOutDir: !devMode
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      VERSION: JSON.stringify(PACKAGE.version)
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['../../packages/sdk-shared/setupTests.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        reportsDirectory: 'tests',
        include: ['src'],
        exclude: ['**/*.test.tsx', '**/*.stories.ts', '**/*.stories.tsx'] // , 'src/index.ts'
      },
      server: {
        deps: {
          inline: ['@plitzi/plitzi-ui']
        }
      },
      reporters: ['default']
    }
  };
});
