import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import viteCompression from 'vite-plugin-compression';

export default defineConfig(({ mode }) => {
  const devMode = mode !== 'production';
  const onlyGzip = !!process.env.ONLY_GZIP;

  return {
    plugins: [
      react(),
      viteCompression({
        algorithm: 'gzip',
        deleteOriginFile: onlyGzip,
        filter: devMode ? /plitzi-builder-dev-vendor.(js|css|js.map)$/ : /plitzi-builder-vendor.(js|css)$/
      })
    ],
    define: {
      'process.env.NODE_ENV': devMode ? '"development"' : '"production"'
    },
    build: {
      outDir: 'dist',
      cssCodeSplit: false,
      rollupOptions: {
        input: path.resolve(import.meta.dirname, './src/vendor-entry.ts'),
        external: [],
        preserveEntrySignatures: 'strict',
        output: {
          format: 'es',
          entryFileNames: devMode ? 'plitzi-builder-dev-vendor.js' : 'plitzi-builder-vendor.js',
          codeSplitting: false,
          manualChunks: undefined,
          chunkFileNames: undefined,
          assetFileNames: 'assets/[name][extname]'
        }
      },
      minify: devMode ? false : 'terser', // usar terser para máxima compresión
      terserOptions: {
        compress: {
          // The chatter goes; what tells somebody something is wrong stays (the SDK's rule, apps/sdk/vite.config.ts):
          // React's own `console.error` of an error a boundary caught is how a production page says it.
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
      sourcemap: devMode,
      emptyOutDir: false
    }
  };
});
