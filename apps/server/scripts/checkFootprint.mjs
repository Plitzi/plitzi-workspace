import fs from 'fs';
import { registerHooks } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * What importing `@plitzi/sdk-server` loads, module by module and package by package — Plitzi's own and every other —
 * held to a budget, run against the build (`yarn check:server-footprint`; CI runs it after `build:prod`).
 *
 * Every server built on this package pays it at start: the dev server, production, `createAuthoringHost`, each
 * `authorIsolated` child. A package imported by its folders loads that folder's whole barrel, so one import from a
 * folder that also holds the browser's hooks, or a helper that pulls a heavy library, brings it along and nothing else
 * would say so — date-fns, through `@plitzi/sdk-shared/helpers`, was half of the server's start once.
 *
 * A module more fails and names what came in, as does a package the budget does not list. A module fewer of a
 * `@plitzi` package fails too, asking for the budget to be lowered, so what was won stays won; of another package it
 * is only said, since upgrading it is what changes it.
 */

const BUDGET = {
  // 205: the job queue's rules are one module every queue shares (`queueRules`), and the default queue is the fleet's
  // (`fleetJobQueue`); the file queue is loaded only by who uses it (`@plitzi/sdk-server/actions`, a project's server).
  // 207: a provider's server `query` read from an external URL (`externalQueryReader`), and the page handler's error
  // page escaped by the one helper (`escapeHtml`).
  // 209: a space's `/sitemap.xml` (`sitemapXml`), and the space a request is served, read once for it and `robots.txt`
  // (`servedSpace`).
  '@plitzi/sdk-server': 209,
  // 147: a provider's `when`, read by the page server as the browser reads it (`providerWhen`, `providerAnswer`, and the
  // global sources' names it tells apart) — and its `input`, resolved with the browser's own bindings and transformers
  // (`serverInputOf`, `getBindingsDetails`, `dataSource/utility`): a date formatted in an input is the same on both.
  // 150: its server `query` (`serverQuery`) over the space's variables, resolved as the browser resolves them
  // (`dataSource/variables` — an entry of its own, so the computed values and their `deepEqual` stay the browser's).
  // 151: which pages a sitemap lists (`navigation/sitemap`), the rule the builder's map of pages shows too.
  '@plitzi/sdk-shared': 151,
  '@plitzi/nexus': 31,
  '@plitzi/plitzi-ui': 19,
  '@plitzi/plitzi-sdk': 1,
  'react-dom': 7,
  react: 6,
  // 63: `dateConverter`, a transformer a provider's input may be bound through (`format`, `parse`, three locales).
  'date-fns': 63,
  // `getBindingsDetails` writes what it resolves on a draft of the element, as in the browser.
  immer: 1,
  ejs: 2,
  scheduler: 2,
  esbuild: 1
};

const here = path.dirname(fileURLToPath(import.meta.url));
const owners = new Map();

/** The package a loaded file belongs to: the `name` of the nearest `package.json` above it. */
const ownerOf = file => {
  for (let dir = path.dirname(file); dir !== path.dirname(dir); dir = path.dirname(dir)) {
    if (owners.has(dir)) {
      return owners.get(dir);
    }

    const manifest = path.join(dir, 'package.json');
    if (fs.existsSync(manifest)) {
      const { name } = JSON.parse(fs.readFileSync(manifest, 'utf-8'));
      if (name) {
        owners.set(dir, { name, dir });

        return owners.get(dir);
      }
    }
  }

  return undefined;
};

const loaded = new Map();
/** Who first imported each file: what a module over the budget is said with, so the barrel that brought it is named. */
const importers = new Map();
registerHooks({
  resolve(specifier, context, next) {
    const resolved = next(specifier, context);
    if (resolved.url.startsWith('file:') && !importers.has(resolved.url) && context.parentURL?.startsWith('file:')) {
      importers.set(resolved.url, fileURLToPath(context.parentURL));
    }

    return resolved;
  },
  load(url, context, next) {
    if (url.startsWith('file:')) {
      const file = fileURLToPath(url);
      const owner = ownerOf(file);
      if (owner) {
        const importer = importers.get(url);
        const by = importer ? ownerOf(importer) : undefined;
        const from =
          importer && by ? ` ← ${by.name === owner.name ? '' : `${by.name} `}${path.relative(by.dir, importer)}` : '';
        loaded.set(owner.name, [...(loaded.get(owner.name) ?? []), `${path.relative(owner.dir, file)}${from}`]);
      }
    }

    return next(url, context);
  }
});

process.chdir(path.join(here, '..'));
await import('@plitzi/sdk-server');

const problems = [];
const notes = [];
const where = 'BUDGET in apps/server/scripts/checkFootprint.mjs';
for (const name of new Set([...Object.keys(BUDGET), ...loaded.keys()])) {
  const files = loaded.get(name) ?? [];
  const budget = BUDGET[name] ?? 0;
  if (files.length > budget) {
    problems.push(
      `${name}: ${String(files.length)} modules, over its budget of ${String(budget)}. If each is one the server uses, ` +
        `raise ${where}; if a folder barrel brought the browser's code or a heavy library along, import what the ` +
        `server uses from an entry without it. Loaded, each with what imported it first:\n  ${files.sort().join('\n  ')}`
    );
  } else if (files.length < budget) {
    (name.startsWith('@plitzi/') ? problems : notes).push(
      `${name}: ${String(files.length)} modules, under its budget of ${String(budget)} — lower ${where} to it, so ` +
        'they cannot come back unnoticed.'
    );
  }
}

for (const note of notes) {
  console.warn(note);
}

if (problems.length > 0) {
  console.error(`What @plitzi/sdk-server loads is not its budget:\n\n${problems.join('\n\n')}`);
  process.exit(1);
}

console.log(
  `@plitzi/sdk-server loads its budget: ${Object.entries(BUDGET)
    .map(([name, count]) => `${name} ${String(count)}`)
    .join(', ')}.`
);
