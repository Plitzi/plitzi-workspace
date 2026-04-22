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
        filter: devMode ? /plitzi-sdk-dev-vendor.(js|css|js.map)$/ : /plitzi-sdk-vendor.(js|css)$/
      })
    ],
    define: {
      'process.env.NODE_ENV': devMode ? '"development"' : '"production"'
    },
    build: {
      outDir: 'dist',
      cssCodeSplit: false,
      rollupOptions: {
        input: path.resolve(__dirname, './src/vendor-entry.ts'),
        external: [],
        preserveEntrySignatures: 'strict',
        output: {
          format: 'es',
          entryFileNames: devMode ? 'plitzi-sdk-dev-vendor.js' : 'plitzi-sdk-vendor.js',
          inlineDynamicImports: true,
          manualChunks: undefined,
          chunkFileNames: undefined,
          assetFileNames: 'assets/[name][extname]'
        }
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
      sourcemap: devMode,
      emptyOutDir: false
    }
  };
});
