import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Serves the harness only — the specs themselves never go through Vite. Same dedupe the examples need: the SDK
 *  and the workspace packages it pulls each resolve React on their own, and two copies break hooks. */
export default defineConfig({
  root: 'harness',
  // Bound explicitly rather than through `localhost`, which resolves to ::1 first on macOS and leaves nothing
  // listening on the loopback address every target in `e2e/targets.ts` is addressed by.
  server: { host: '127.0.0.1', port: 4100, strictPort: true },
  resolve: { dedupe: ['react', 'react-dom'] },
  plugins: [react()]
});
