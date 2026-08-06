import type { Plugin } from 'esbuild';

const NAMESPACE = 'zod-locales-stub';
const ZOD_PACKAGE = /node_modules[/\\]zod[/\\]/u;

/** Drops zod's ~40 translations (194 KB): they are re-exported as a namespace, which no bundler can tree-shake.
 *  English survives because zod imports `locales/en.js` directly, not through this index. */
export const zodEnglishOnly: Plugin = {
  name: 'zod-english-only',
  setup(builder) {
    // esbuild compiles plugin filters as Go regexps, so they take no JS flags.
    builder.onResolve({ filter: /locales[/\\]index\.js$/ }, args =>
      ZOD_PACKAGE.test(args.importer) ? { path: args.path, namespace: NAMESPACE } : undefined
    );
    builder.onLoad({ filter: /.*/, namespace: NAMESPACE }, () => ({ contents: 'export {};', loader: 'js' }));
  }
};
