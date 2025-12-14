/// <reference types="vite/client" />
/// <reference types="vitest" />

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { nodeResolve } from '@rollup/plugin-node-resolve';
import react from '@vitejs/plugin-react';
import ejs from 'ejs';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import viteCompression from 'vite-plugin-compression';
// import dts from 'vite-plugin-dts';
import { ViteEjsPlugin } from 'vite-plugin-ejs';

import type { Plugin } from 'vite';

const require = createRequire(import.meta.url);
const PACKAGE = require('./package.json') as {
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
const reactVersionRaw =
  PACKAGE.dependencies?.react || PACKAGE.devDependencies?.react || PACKAGE.peerDependencies?.react;
const reactVersion = reactVersionRaw?.replace(/^[^\d]*/, '');

const baseUrl = new URL('.', import.meta.url);

const packages = {
  '@plitzi/sdk-auth': path.resolve(baseUrl.pathname, '../../packages/sdk-auth/src'),
  '@plitzi/sdk-data-source': path.resolve(baseUrl.pathname, '../../packages/sdk-data-source/src'),
  '@plitzi/sdk-dev-tools': path.resolve(baseUrl.pathname, '../../packages/sdk-dev-tools/src'),
  '@plitzi/sdk-elements': path.resolve(baseUrl.pathname, '../../packages/sdk-elements/src'),
  '@plitzi/sdk-event-bridge': path.resolve(baseUrl.pathname, '../../packages/sdk-event-bridge/src'),
  '@plitzi/sdk-interactions': path.resolve(baseUrl.pathname, '../../packages/sdk-interactions/src'),
  '@plitzi/sdk-navigation': path.resolve(baseUrl.pathname, '../../packages/sdk-navigation/src'),
  '@plitzi/sdk-plugins': path.resolve(baseUrl.pathname, '../../packages/sdk-plugins/src'),
  '@plitzi/sdk-schema': path.resolve(baseUrl.pathname, '../../packages/sdk-schema/src'),
  '@plitzi/sdk-shared': path.resolve(baseUrl.pathname, '../../packages/sdk-shared/src'),
  '@plitzi/sdk-state': path.resolve(baseUrl.pathname, '../../packages/sdk-state/src'),
  '@plitzi/sdk-style': path.resolve(baseUrl.pathname, '../../packages/sdk-style/src'),
  '@plitzi/sdk-variables': path.resolve(baseUrl.pathname, '../../packages/sdk-variables/src')
};

// const importedPackages = new Set();

function ejsPlugin(devMode: boolean): Plugin {
  return {
    name: 'vite-plugin-ejs-index',

    generateBundle() {
      const templatePath = path.resolve(__dirname, './index.html');
      if (fs.existsSync(templatePath)) {
        const template = fs.readFileSync(templatePath, 'utf-8');
        const html = ejs.render(
          template,
          {
            title: 'Plitzi SDK Builder',
            jsPath: '/plitzi-builder.js',
            cssPath: '/plitzi-builder.css',
            react: devMode ? `https://esm.sh/react@${reactVersion}?dev` : `https://esm.sh/react@${reactVersion}`,
            reactJsx: devMode
              ? `https://esm.sh/react@${reactVersion}/jsx-runtime?dev`
              : `https://esm.sh/react@${reactVersion}/jsx-runtime`,
            reactDom: devMode
              ? `https://esm.sh/react-dom@${reactVersion}?dev`
              : `https://esm.sh/react-dom@${reactVersion}`,
            reactDomClient: devMode
              ? `https://esm.sh/react-dom@${reactVersion}/client?dev`
              : `https://esm.sh/react-dom@${reactVersion}/client`,
            version: PACKAGE.version
          },
          { async: false }
        );
        this.emitFile({ type: 'asset', fileName: 'index.html', source: html as string });
      }
    }
  };
}

export default defineConfig(({ mode, command }) => {
  const devMode = mode !== 'production';
  const onlyAnalyze = !!process.env.ONLY_ANALYZE;
  const onlyGzip = !!process.env.ONLY_GZIP;
  const isWatch = process.argv.includes('--watch');
  // const isSSR = process.argv.includes('--ssr');

  return {
    plugins: [
      nodeResolve({ extensions: ['.js', '.mjs', '.ts', '.tsx'] }),
      react(),
      ViteEjsPlugin({
        title: 'Plitzi SDK Builder',
        description: '',
        jsPath: devMode ? '/src/index.tsx' : '/plitzi-builder.js',
        cssPath: '/plitzi-builder.css',
        react: devMode ? '/src/index-dev-hmr.ts' : `https://esm.sh/react@${reactVersion}`, // ?dev (esm.sh)
        reactJsx: devMode ? '/src/index-dev-hmr.ts' : `https://esm.sh/react@${reactVersion}/jsx-runtime`, // ?dev (esm.sh)
        reactDom: devMode ? '/src/index-dev-hmr.ts' : `https://esm.sh/react-dom@${reactVersion}`, // ?dev (esm.sh)
        reactDomClient: devMode ? '/src/index-dev-hmr.ts' : `https://esm.sh/react-dom@${reactVersion}/client`, // ?dev (esm.sh)
        version: PACKAGE.version
      }),
      command === 'build' && ejsPlugin(devMode),
      !isWatch &&
        viteCompression({ algorithm: 'gzip', deleteOriginFile: onlyGzip, filter: /plitzi-builder.(js|css)$/ }),
      // dts({
      //   entryRoot: 'src',
      //   outDir: 'dist',
      //   rollupTypes: false,
      //   exclude: ['**/*.test.tsx', '**/*.stories.ts', '**/*.stories.tsx', 'vite.config.ts', 'setupTests.ts'],
      //   tsconfigPath: './tsconfig.json'
      // }),
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
      port: 3000,
      open: false
    },
    resolve: {
      alias: {
        '@pmodules': path.resolve('./src/modules'),
        '@pcomponents': path.resolve('./src/components'),
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
        treeshake: true, // probar bien esto
        external: [
          'react',
          'react-dom',
          'react-dom/client',
          'react-dom/server',
          'react/jsx-runtime',
          'react/jsx-dev-runtime',
          '@plitzi/plitzi-sdk'
        ],
        output: [
          {
            format: 'es',
            exports: 'named',
            manualChunks: undefined,
            inlineDynamicImports: !devMode,
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
          drop_console: true, // elimina console.log
          drop_debugger: true // elimina debugger
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
