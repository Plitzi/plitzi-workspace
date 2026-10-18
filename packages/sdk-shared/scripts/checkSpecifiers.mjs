import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Every `@plitzi/<package>/<subpath>` the workspace writes, checked against what that package exports — run after a
 * build (`yarn check:specifiers`; CI runs it after `build:prod`).
 *
 * A library package is imported by its root and its folders, never by a file, and an import of a path a package does
 * not export fails at start with `ERR_MODULE_NOT_FOUND` into its `dist`. Such a path keeps coming back from wherever it
 * is still written: the code itself, its built declarations (`import("…")` in a `.d.ts`), and every text a person or an
 * agent copies an import from — a JSDoc, a skill, a README, the docs. So all of them are read:
 *
 * - what is published (`dist`): the specifiers it holds, quoted, as an import or `import()` names one;
 * - the source and the docs: every mention, prose included.
 *
 * Not read: tests (a migration's tests write the old paths on purpose), changelogs (what was true then) and RFCs (they
 * propose entries that do not exist yet).
 */

const SELF = fileURLToPath(import.meta.url);
const WORKSPACE = path.resolve(path.dirname(SELF), '../../..');
const ROOTS = ['apps', 'packages', 'examples', 'e2e', 'docs'];
const NOT_READ = new Set(['node_modules', '.git', '.turbo', 'coverage', '.artifacts', 'tmp', 'rfc']);
const READ = /\.(m?[jt]sx?|md|mdx|ejs|html)$/;
const TEST = /\.(test|spec|stories|bench)\.[cm]?[jt]sx?$/;
const QUOTED = /['"`]@plitzi\/([a-z0-9-]+)\/([A-Za-z0-9_./-]*[A-Za-z0-9_])['"`]/g;
// Any mention, but not a path inside a package's folder (`@plitzi/nexus/dist/…`, a bundle's region comment).
const MENTIONED = /(?<![\w/.-])@plitzi\/([a-z0-9-]+)\/((?!dist\/|node_modules\/|src\/)[A-Za-z0-9_./-]*[A-Za-z0-9_])/g;

/** Written on purpose, each with why: a text describing the shape that no longer works. */
const ALLOWED = [
  {
    files: ['apps/cli/src/migrations/changes/folderImports.ts', 'apps/cli/dist/index.js'],
    specifier: '@plitzi/sdk-shared/helpers/isRecord',
    why: 'the migration that rewrites file imports, saying which shape it rewrites'
  }
];

const allowed = (file, specifier) => ALLOWED.some(entry => entry.specifier === specifier && entry.files.includes(file));

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf-8'));

/** For each `@plitzi` package, whether a subpath is one it exports — a folder with an `index` for `"./*"`. */
const exportsOf = () => {
  const answers = new Map();
  for (const group of ['apps', 'packages']) {
    for (const name of fs.readdirSync(path.join(WORKSPACE, group))) {
      const dir = path.join(WORKSPACE, group, name);
      const manifest = path.join(dir, 'package.json');
      if (!fs.existsSync(manifest)) {
        continue;
      }

      const { name: packageName, exports = {} } = readJson(manifest);
      if (!packageName?.startsWith('@plitzi/')) {
        continue;
      }

      const keys = Object.keys(exports);
      answers.set(packageName, subpath =>
        keys.some(key => {
          if (!key.includes('*')) {
            return key === `./${subpath}`;
          }

          const [before, after] = key.split('*');
          if (!`./${subpath}`.startsWith(before) || !`./${subpath}`.endsWith(after)) {
            return false;
          }

          return (
            key !== './*' || ['ts', 'tsx'].some(ext => fs.existsSync(path.join(dir, 'src', subpath, `index.${ext}`)))
          );
        })
      );
    }
  }

  // Installed rather than in the workspace: what their own `exports` say.
  for (const packageName of ['@plitzi/plitzi-ui', '@plitzi/nexus']) {
    const keys = Object.keys(readJson(path.join(WORKSPACE, 'node_modules', packageName, 'package.json')).exports ?? {});
    answers.set(packageName, subpath => keys.includes(`./${subpath}`));
  }

  return answers;
};

const exported = exportsOf();
const found = [];

const read = (dir, inDist) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (NOT_READ.has(entry.name)) {
      continue;
    }

    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      read(file, inDist || entry.name === 'dist');
      continue;
    }

    // This file names the shapes it refuses, to say what they are.
    if (!READ.test(entry.name) || TEST.test(entry.name) || entry.name === 'CHANGELOG.md' || file === SELF) {
      continue;
    }

    const text = fs.readFileSync(file, 'utf-8');
    for (const match of text.matchAll(inDist ? QUOTED : MENTIONED)) {
      const [, name, written] = match;
      const answers = exported.get(`@plitzi/${name}`);
      const relative = path.relative(WORKSPACE, file);
      // A symbol's description (`Symbol('@plitzi/nexus/cancel')`) names nothing to import.
      const isSymbol = /Symbol(\.for)?\(\s*$/.test(text.slice(Math.max(0, match.index - 12), match.index));
      if (
        !answers ||
        isSymbol ||
        answers(written) ||
        answers(written.replace(/\.(m?js|tsx?)$/, '')) ||
        allowed(relative, `@plitzi/${name}/${written}`)
      ) {
        continue;
      }

      found.push(`${relative}:${String(text.slice(0, match.index).split('\n').length)}  @plitzi/${name}/${written}`);
    }
  }
};

for (const root of ROOTS) {
  read(path.join(WORKSPACE, root), false);
}

if (found.length > 0) {
  console.error(
    `${String(found.length)} place(s) name a path its package does not export — imported from there, it fails with ERR_MODULE_NOT_FOUND. ` +
      `A package is imported by its root and its folders (\`@plitzi/sdk-shared/helpers\`), never by a file:\n  ${found.join('\n  ')}`
  );
  process.exit(1);
}

console.log('✅ every @plitzi path the workspace writes is one its package exports');
