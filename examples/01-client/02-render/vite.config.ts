import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // The SDK and the workspace packages it pulls ship ESM but expect a single React instance; without dedupe the
  // portal-linked copies would each bring their own and hooks would break.
  resolve: { dedupe: ['react', 'react-dom'] },
  plugins: [react()]
});
