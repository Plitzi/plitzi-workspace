import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

// Astro 6 LTS toolchain. The Nexus code in `src/` is byte-for-byte identical to the astro-7 example — only the
// framework version differs.
export default defineConfig({
  integrations: [react()]
});
