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
  '@plitzi/sdk-variables': path.resolve(baseUrl.pathname, '../../packages/sdk-variables/src')
};

// const importedPackages = new Set();

/** The credentials and endpoints `index.html` boots with, overridable from the environment — the same contract
 *  the builder uses, so one command can point either app at a different backend. Set nothing and the values are
 *  exactly the ones that were always there.
 *
 *  Defined once because TWO renderers use the template: the dev server's EJS plugin and the build's own
 *  `generateBundle`. EJS throws on a variable it was not given, so a list that lives in one of them and not the
 *  other is a build that fails while the dev server is perfectly happy. */
const bootstrap = () => ({
  webKey: process.env.PLITZI_WEB_KEY ?? '',
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
            title: 'Plitzi Demo',
            jsPath: '/plitzi-sdk.js',
            cssPath: '/plitzi-sdk.css',
            iconsCssPath: `/${ICONS_CSS}`,
            react: devMode ? '/plitzi-sdk-dev-vendor.js' : '/plitzi-sdk-vendor.js',
            reactJsx: devMode ? '/plitzi-sdk-dev-vendor.js' : '/plitzi-sdk-vendor.js',
            reactDom: devMode ? '/plitzi-sdk-dev-vendor.js' : '/plitzi-sdk-vendor.js',
            reactDomClient: devMode ? '/plitzi-sdk-dev-vendor.js' : '/plitzi-sdk-vendor.js',
            version: PACKAGE.version
          },
          { async: false }
        );
        this.emitFile({ type: 'asset', fileName: 'index.html', source: html });
      }
    }
  };
}

/** The icon sets the SDK draws `fontAwesome` elements with, in the order their rules have to be read. */
const ICON_SHEETS = ['fontawesome', 'solid', 'regular', 'brands'] as const;

const ICONS_CSS = 'plitzi-sdk-icons.css';

const FONT_URL = /url\(\.\.\/webfonts\/([\w.-]+)\)/g;

/**
 * The icon stylesheet: Font Awesome's rules in the SDK's `components` layer, its fonts as files beside it.
 *
 * In `plitzi-sdk.css` they were inlined — a library build inlines every asset a stylesheet names — so each page waited
 * on some 400 KB of base64 fonts before it could paint a word, and downloaded them again on every version. As files, a
 * face is fetched only when an icon of its style is on the page, in parallel, and cached on its own. The URLs are
 * relative, so the sheet works wherever the SDK's assets are served from: the page server, a CDN, a static export.
 *
 * The sheet opens with the SDK's own layer order, read from `plitzi-sdk.scss` — not from the built stylesheet, where
 * the minifier spreads the one statement over each layer's first use: whichever of the two a page loads first,
 * `components` stays where the SDK put it.
 */
const iconsAsset = (layerOrder: string): { css: string; fonts: Map<string, Buffer> } => {
  const require = createRequire(import.meta.url);
  const fonts = new Map<string, Buffer>();
  const rules = ICON_SHEETS.map(sheet => {
    const file = require.resolve(`@fortawesome/fontawesome-free/css/${sheet}.min.css`);

    return fs.readFileSync(file, 'utf8').replace(FONT_URL, (_match, font: string) => {
      fonts.set(font, fs.readFileSync(path.join(path.dirname(file), '..', 'webfonts', font)));

      return `url(webfonts/${font})`;
    });
  }).join('\n');

  return { css: `${layerOrder}\n@layer components {\n${rules}\n}\n`, fonts };
};

const LAYER_ORDER = /@layer\s+[\w-]+(?:\s*,\s*[\w-]+)+\s*;/;

const sourceLayerOrder = (): string => {
  const scss = fs.readFileSync(path.resolve(import.meta.dirname, 'src/assets/plitzi-sdk.scss'), 'utf8');
  const order = LAYER_ORDER.exec(scss)?.[0];
  if (!order) {
    throw new Error('plitzi-sdk.scss declares no layer order for the icon stylesheet to follow');
  }

  return order;
};

function iconsPlugin(): Plugin {
  return {
    name: 'plitzi-icons',

    configureServer(server) {
      // The development page asks for the same sheet the build makes, so it is made the same way.
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        const isFont = url.startsWith('/webfonts/');
        if (url !== `/${ICONS_CSS}` && !isFont) {
          next();

          return;
        }

        const { css, fonts } = iconsAsset(sourceLayerOrder());
        const font = isFont ? fonts.get(url.slice('/webfonts/'.length)) : undefined;
        if (isFont && !font) {
          next();

          return;
        }

        res.setHeader('Content-Type', font ? 'font/woff2' : 'text/css');
        res.end(font ?? css);
      });
    },

    generateBundle() {
      const { css, fonts } = iconsAsset(sourceLayerOrder());
      this.emitFile({ type: 'asset', fileName: ICONS_CSS, source: css });
      for (const [font, source] of fonts) {
        this.emitFile({ type: 'asset', fileName: `webfonts/${font}`, source });
      }
    }
  };
}

function renameCssPlugin(): Plugin {
  return {
    name: 'vite-plugin-rename-css',
    enforce: 'post',

    closeBundle() {
      const outDir = path.resolve(import.meta.dirname, 'dist');
      const cssFiles = fs
        .readdirSync(outDir)
        .filter(f => f.endsWith('.css') && f !== 'plitzi-sdk-devtools.css' && f !== ICONS_CSS);

      for (const file of cssFiles) {
        const targetPath = path.join(outDir, 'plitzi-sdk.css');
        const sourcePath = path.join(outDir, file);

        fs.renameSync(sourcePath, targetPath);
        break;
      }
    }
  };
}

/** What `vite.vendor.config.ts` builds into the same `dist`: React and its kin, a separate build of their own. */
const VENDOR_OUTPUT = /^plitzi-sdk(-dev)?-vendor\.js(\.map)?(\.gz)?$/;

/**
 * Empties `dist` of what this build made before — and only of that.
 *
 * `emptyOutDir` empties all of it, and the vendor bundles are built into the same folder by another config: a
 * production build left a `dist` with no React, and every page served from it answered a script that 302'd to HTML.
 * Run at the start of a production build only; a development build overwrites in place, as it always has.
 */
function cleanOwnOutputPlugin(): Plugin {
  return {
    name: 'plitzi-clean-own-output',
    apply: 'build',

    buildStart() {
      const outDir = path.resolve(import.meta.dirname, 'dist');
      if (!fs.existsSync(outDir)) {
        return;
      }

      for (const entry of fs.readdirSync(outDir)) {
        if (!VENDOR_OUTPUT.test(entry)) {
          fs.rmSync(path.join(outDir, entry), { recursive: true, force: true });
        }
      }
    }
  };
}

/** What the SDK's own module is called wherever it is loaded: the import map of every page that runs it, and the name
 *  a bundler resolves it by. Plugins import the SDK by it too. */
const SDK_SPECIFIER = '@plitzi/plitzi-sdk';

const DEVTOOLS_CHUNK = /^plitzi-sdk-devtools-[\w-]+\.js$/;

/**
 * Holds the one split this build allows: the dev-tools panel, a chunk of its own that `plitzi-sdk.js` imports only
 * when a page is allowed to debug and has a panel to show.
 *
 * The chunk shares the SDK's modules — the stores the panel inspects, the registries, the contexts — so it has to reach
 * the very module the page loaded, not a copy of it. Left to the bundler it imports `./plitzi-sdk.js`, and a page that
 * loaded the SDK as `plitzi-sdk.js?v=…` (the page server's cache-buster) would evaluate the whole SDK a second time,
 * and the panel would inspect an empty one. So the chunk imports it by name: an import map resolves that to the URL the
 * page loaded, and a bundler to the same file.
 *
 * Anything else split off is a file the pages would have to know about, so it fails the build rather than ship.
 */
function devToolsChunkPlugin(): Plugin {
  return {
    name: 'plitzi-devtools-chunk',
    apply: 'build',
    enforce: 'post',

    generateBundle(_options, bundle) {
      const split = Object.values(bundle).filter(output => output.type === 'chunk' && !output.isEntry);
      if (split.length > 1) {
        this.error(`The SDK splits into one dev-tools chunk, and this build split off ${String(split.length)} chunks.`);
      }

      for (const output of split) {
        if (output.type !== 'chunk') {
          continue;
        }

        if (!output.isDynamicEntry || !DEVTOOLS_CHUNK.test(output.fileName)) {
          this.error(
            `${output.fileName}: the SDK is one file and its dev-tools chunk. A dynamic import() in the source split this off; import it statically, or place it in the dev-tools group.`
          );
        }

        const entryImport = /(["'])\.\/plitzi-sdk\.js\1/g;
        if (!entryImport.test(output.code)) {
          this.error(
            `${output.fileName}: the dev-tools chunk no longer imports plitzi-sdk.js, so it cannot be pointed at it.`
          );
        }

        output.code = output.code.replace(entryImport, `$1${SDK_SPECIFIER}$1`);
      }
    },

    // A development build writes over the last one in place, so the chunk a previous build hashed differently is removed
    // here rather than left beside the new one.
    writeBundle(options, bundle) {
      const outDir = options.dir;
      if (!outDir) {
        return;
      }

      for (const file of fs.readdirSync(outDir)) {
        if (DEVTOOLS_CHUNK.test(file) && !(file in bundle)) {
          fs.rmSync(path.join(outDir, file), { force: true });
        }
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
  // mkcert turns its logger on by writing `process.env.DEBUG`, which every library reading DEBUG obeys under Vitest
  // too. Tests serve nothing, so they need no certificate.
  const testing = !!process.env.VITEST;
  // const isSSR = process.argv.includes('--ssr');

  return {
    plugins: [
      !testing && mkcert(),
      react(),
      ViteEjsPlugin({
        ...bootstrap(),
        title: 'Plitzi SDK',
        description: '',
        jsPath: devMode ? '/src/index.tsx' : '/plitzi-sdk.js',
        cssPath: '/plitzi-sdk.css',
        iconsCssPath: `/${ICONS_CSS}`,
        react: devMode ? '/src/vendor-entry.ts' : '/plitzi-sdk-vendor.js',
        reactJsx: devMode ? '/src/vendor-entry.ts' : '/plitzi-sdk-vendor.js',
        reactDom: devMode ? '/src/vendor-entry.ts' : '/plitzi-sdk-vendor.js',
        reactDomClient: devMode ? '/src/vendor-entry.ts' : '/plitzi-sdk-vendor.js',
        version: PACKAGE.version
      }),
      command === 'build' && !devMode && cleanOwnOutputPlugin(),
      command === 'build' && ejsPlugin(devMode),
      iconsPlugin(),
      command === 'build' && renameCssPlugin(),
      command === 'build' && devToolsChunkPlugin(),
      !isWatch &&
        viteCompression({
          algorithm: 'gzip',
          deleteOriginFile: onlyGzip,
          filter: /plitzi-sdk(-devtools(-[\w-]+)?|-icons)?\.(js|css)$/
        }),
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
        tsconfigPath: './tsconfig.app.json',
        // A development build points the packages at their sources; the types it writes must not. Left to the
        // plugin, every import of one became a path into `packages/*/src`, and whatever typechecked against this
        // build compiled those sources under its own settings — the examples' `erasableSyntaxOnly` refusing their
        // enums — while a production build said nothing.
        aliasesExclude: Object.keys(packages),
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
        // react: path.resolve(import.meta.dirname, '../../node_modules/react'),
        // 'react/jsx-runtime': path.resolve(import.meta.dirname, '../../node_modules/react'),
        // 'react-dom': path.resolve(import.meta.dirname, '../../node_modules/react-dom'),
        // 'react-dom/client': path.resolve(import.meta.dirname, '../../node_modules/react-dom'),
        '@modules': path.resolve('./src/modules'),
        '@components': path.resolve('./src/components'),
        'decode-named-character-reference': path.resolve(
          import.meta.dirname,
          '../../node_modules/decode-named-character-reference/index.js'
        ),
        ...(devMode ? packages : {})
      },
      extensions: ['.js', '.mjs', '.ts', '.tsx'],
      // `@plitzi/nexus` and `@plitzi/plitzi-ui` may be linked through portals, each carrying its own node_modules. React and
      // CodeMirror check identity (a hook's dispatcher, an extension's `instanceof`), so a second copy breaks them: one each.
      dedupe: [
        'react',
        'react-dom',
        '@codemirror/autocomplete',
        '@codemirror/commands',
        '@codemirror/language',
        '@codemirror/lint',
        '@codemirror/search',
        '@codemirror/state',
        '@codemirror/view',
        '@lezer/common',
        '@lezer/highlight',
        '@lezer/lr'
      ]
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
        // Lets the entry hold the code its dev-tools chunk shares with it, rather than turning into a facade that
        // re-exports it from a third file: the chunk has to be able to import the SDK by name (see
        // `devToolsChunkPlugin`), and the page to load one file.
        preserveEntrySignatures: 'allow-extension',
        external: [
          'react',
          'react-dom',
          'react-dom/client',
          'react-dom/server',
          'react/jsx-runtime',
          'react/jsx-dev-runtime',
          'react/compiler-runtime'
        ],
        output: [
          {
            format: 'es',
            exports: 'named',
            /**
             * One file, and the dev-tools panel beside it. The SDK is loaded from a `<script>` by name — by the page
             * server, by a static HTML, by a space somebody hosts wherever — so everything a page runs is in
             * `plitzi-sdk.js`: the group takes every module the entry reaches statically, which inlines the dynamic
             * `import()`s the plugin loader uses to break an evaluation cycle. What is left is what only the panel
             * reaches, loaded by the SDK itself when a page may debug — see `devToolsChunkPlugin`. Hashed, because the
             * assets are cached and the SDK reaches it by a URL no cache-buster is added to.
             */
            codeSplitting: { groups: [{ name: 'plitzi-sdk', tags: ['$initial'] }] },
            chunkFileNames: 'plitzi-sdk-devtools-[hash].js',
            entryFileNames: 'plitzi-sdk.js',
            assetFileNames: '[name].[ext]',
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
          // The chatter goes; what tells somebody something is wrong stays. `warn` and `error` are how the SDK says an
          // override was ignored or a render failed, on the published site as anywhere else — dropping them made
          // those silent exactly where nobody can attach a debugger.
          drop_console: ['log', 'info', 'debug'],
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
      emptyOutDir: false
    },
    define: {
      /**
       * The MODE this build was asked for, not whatever the shell happened to export.
       *
       * `build:dev` passes `--mode development` and then this fell back to `'production'`, because nobody sets
       * NODE_ENV before running turbo — so the "dev" bundle identified as production and every dev-only branch
       * inside it was compiled away. The visible half of that: nexus registers its stores in a dev-only registry,
       * so the dev-tools Store tab and its instance dropdown were permanently empty in any page loading this
       * bundle, while the tabs that do not depend on it (Logs, History) worked fine and made it look deliberate.
       */
      // Vite sets `process.env.NODE_ENV` itself before the config is read, so consulting it here only ever
      // echoed Vite back. The MODE the build was asked for is the intent, and the only thing that is.
      'process.env.NODE_ENV': JSON.stringify(devMode ? 'development' : 'production'),
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
