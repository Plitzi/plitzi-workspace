import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

// Astro 7: Vite 8 + the Rust compiler are the defaults — no extra flags needed. The React integration (v6) drives
// the islands.
export default defineConfig({
  integrations: [react()]
});
