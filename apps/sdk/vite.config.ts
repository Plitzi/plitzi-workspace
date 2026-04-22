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

function ejsPlugin(): Plugin {
  return {
    name: 'vite-plugin-ejs-index',

    generateBundle() {
      const templatePath = path.resolve(__dirname, './index.html');
      if (fs.existsSync(templatePath)) {
        const template = fs.readFileSync(templatePath, 'utf-8');
        const html = ejs.render(
          template,
          {
            title: 'Plitzi Demo',
            jsPath: '/plitzi-sdk.js',
            cssPath: '/plitzi-sdk.css',
            react: '/plitzi-sdk-vendor.js',
            reactJsx: '/plitzi-sdk-vendor.js',
            reactDom: '/plitzi-sdk-vendor.js',
            reactDomClient: '/plitzi-sdk-vendor.js',
            version: PACKAGE.version
          },
          { async: false }
        );
        this.emitFile({ type: 'asset', fileName: 'index.html', source: html });
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
      mkcert(),
      react(),
      ViteEjsPlugin({
        title: 'Plitzi SDK',
        description: '',
        jsPath: devMode ? '/src/index.tsx' : '/plitzi-sdk.js',
        cssPath: '/plitzi-sdk.css',
        react: devMode ? '/src/vendor-entry.ts' : '/plitzi-sdk-vendor.js',
        reactJsx: devMode ? '/src/vendor-entry.ts' : '/plitzi-sdk-vendor.js',
        reactDom: devMode ? '/src/vendor-entry.ts' : '/plitzi-sdk-vendor.js',
        reactDomClient: devMode ? '/src/vendor-entry.ts' : '/plitzi-sdk-vendor.js',
        version: PACKAGE.version
      }),
      command === 'build' && ejsPlugin(),
      !isWatch &&
        viteCompression({ algorithm: 'gzip', deleteOriginFile: onlyGzip, filter: /plitzi-sdk(|-devtools).(js|css)$/ }),
      dts({
        entryRoot: 'src',
        outDir: 'dist',
        rollupTypes: false,
        exclude: [
          '**/*.test.tsx',
          '**/*.stories.ts',
          '**/*.stories.tsx',
          'vite.config.ts',
          'setupTests.ts',
          'vendor-entry.ts'
        ],
        tsconfigPath: './tsconfig.app.json'
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
        'prop-types',
        'style-to-js',
        'debug',
        'extend',
        'lowlight',
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
      host: 'app.plitzi.local',
      port: 3001,
      open: false
    },
    resolve: {
      alias: {
        // react: path.resolve(__dirname, '../../node_modules/react'),
        // 'react/jsx-runtime': path.resolve(__dirname, '../../node_modules/react'),
        // 'react-dom': path.resolve(__dirname, '../../node_modules/react-dom'),
        // 'react-dom/client': path.resolve(__dirname, '../../node_modules/react-dom'),
        '@modules': path.resolve('./src/modules'),
        '@components': path.resolve('./src/components'),
        'decode-named-character-reference': path.resolve(
          __dirname,
          '../../node_modules/decode-named-character-reference/index.js'
        ),
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
      cssCodeSplit: true,
      rollupOptions: {
        treeshake: true,
        external: [
          'react',
          'react-dom',
          'react-dom/client',
          'react-dom/server',
          'react/jsx-runtime',
          'react/jsx-dev-runtime'
        ],
        output: [
          {
            format: 'es',
            exports: 'named',
            manualChunks: undefined,
            // inlineDynamicImports: true, // false if u want to have chunks !devMode,
            entryFileNames: 'plitzi-sdk.js',
            // assetFileNames: assetInfo => {
            //   const { names } = assetInfo;
            //   if (names[0] === 'index.css') {
            //     return 'plitzi-sdk.css';
            //   }

            //   return assetInfo.names[0];
            // },
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
