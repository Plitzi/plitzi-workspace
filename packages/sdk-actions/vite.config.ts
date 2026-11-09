/// <reference types="vite/client" />

import fs from 'node:fs';
import path from 'node:path';

import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const root = new URL('.', import.meta.url).pathname;

/** Skips rewriting a declaration whose content is already on disk: replacing every `.d.ts` on every build is what makes
 *  the editors holding them open fall over. Inlined rather than shared: a vite config importing across packages breaks
 *  `composite` type-checking (TS6059). */
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

/** One entry per folder of `src` (`exports` "./*" → a folder's index), and the root, which carries types alone. */
const entries = Object.fromEntries([
  ['index', path.resolve(root, 'src/index.ts')],
  ...fs
    .readdirSync(path.resolve(root, 'src'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.resolve(root, 'src', entry.name, 'index.ts')))
    .map(entry => [`${entry.name}/index`, path.resolve(root, 'src', entry.name, 'index.ts')])
]);

export default defineConfig(({ mode }) => ({
  plugins: [
    dts({
      include: ['src'],
      entryRoot: 'src',
      exclude: ['**/*.test.ts', '**/tests/**'],
      tsconfigPath: './tsconfig.app.json',
      // The declarations are written against the other packages' declarations, as a consumer reads them.
      compilerOptions: { customConditions: [] },
      beforeWriteFile: skipUnchangedDts
    })
  ],
  build: {
    // Kept during development so `beforeWriteFile` has something to compare against.
    emptyOutDir: mode === 'production',
    lib: { entry: entries, formats: ['es'] },
    rollupOptions: {
      // Every package is the consumer's to install: what this one names is resolved where it runs.
      external: id => id.startsWith('node:') || (!id.startsWith('.') && !path.isAbsolute(id)),
      // One file per entry and what they share in a few chunks: Node resolves, loads and links each module it imports,
      // and a server's start is mostly that. One copy of each module whichever entries a process imports — the log's
      // level and the fleet's link are state of the process.
      output: { format: 'es', entryFileNames: '[name].mjs', chunkFileNames: 'chunks/[name]-[hash].mjs' }
    },
    target: 'node20',
    ssr: true,
    minify: false
  }
}));
