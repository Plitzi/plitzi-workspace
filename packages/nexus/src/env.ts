// Bundler-agnostic dev/prod/test detection. Avoids `import.meta.env` (Vite/Astro-only, and absent under raw `tsx`
// or webpack) so Nexus behaves identically under webpack, esbuild, Rollup, Bun, Node and Vite. Every major bundler
// statically replaces `process.env.NODE_ENV`; the runtime guard covers plain Node/ESM where it isn't defined.
const resolveMode = (): string => {
  if (typeof process !== 'undefined' && process.env.NODE_ENV) {
    return process.env.NODE_ENV;
  }

  return 'production';
};

export const MODE = resolveMode();
export const isProd = MODE === 'production';
export const isDev = !isProd;
export const isTest = MODE === 'test';
