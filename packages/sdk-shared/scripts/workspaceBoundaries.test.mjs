import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const WORKSPACE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SOURCE_CONDITION = '@plitzi/source';
const NOT_SOURCE = new Set(['node_modules', 'dist', '.turbo', 'coverage']);
const TEST_FILE = /(\.(test|spec|stories|bench)\.[cm]?[jt]sx?$)|(^|\/)(__tests__|__mocks__|testUtils)\//;

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf-8'));

/** Every package of the workspace that has sources: `apps/*` and `packages/*`. */
const workspacePackages = () =>
  ['apps', 'packages'].flatMap(group =>
    fs
      .readdirSync(path.join(WORKSPACE, group))
      .map(name => path.join(WORKSPACE, group, name))
      .filter(dir => fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'src')))
      .map(dir => ({ dir, manifest: readJson(path.join(dir, 'package.json')) }))
  );

const sourceFiles = dir =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return NOT_SOURCE.has(entry.name) ? [] : sourceFiles(full);
    }

    return /\.[cm]?[jt]sx?$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [full] : [];
  });

/**
 * The packages a file imports, by name. Read by TypeScript's own pre-processor, so a specifier inside a string — the
 * CLI's scaffold templates, a skill's recipe — is not taken for an import.
 */
const importedPackages = file =>
  ts
    .preProcessFile(fs.readFileSync(file, 'utf-8'), true, true)
    .importedFiles.map(({ fileName }) => fileName)
    .filter(spec => !spec.startsWith('.') && !spec.startsWith('/') && !spec.startsWith('node:'))
    .map(spec =>
      spec
        .split('/')
        .slice(0, spec.startsWith('@') ? 2 : 1)
        .join('/')
    );

const packages = workspacePackages();
const names = new Set(packages.map(({ manifest }) => manifest.name));

/** What each package's sources import of the workspace, tests apart, read once for every check below. */
const usage = packages.map(({ dir, manifest }) => {
  const shipped = new Map();
  const tests = new Map();
  for (const file of sourceFiles(path.join(dir, 'src'))) {
    const relative = path.relative(dir, file);
    const into = TEST_FILE.test(relative) ? tests : shipped;
    for (const name of importedPackages(file)) {
      if (name !== manifest.name && name.startsWith('@plitzi/')) {
        into.set(name, [...(into.get(name) ?? []), relative]);
      }
    }
  }

  return { manifest, shipped, tests };
});

/**
 * The lines between the workspace's packages, held where CI runs: a package works on its own — tested, typechecked and
 * debugged against its sources — only while what it reaches for is declared and the graph has no loop in it.
 */
describe('workspace boundaries', () => {
  it('declares every Plitzi package a package imports', () => {
    const undeclared = usage.flatMap(({ manifest, shipped, tests }) => {
      const declared = new Set(
        Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies, ...manifest.devDependencies })
      );

      return [...shipped, ...tests]
        .filter(([name]) => !declared.has(name))
        .map(([name, files]) => `${manifest.name} imports ${name} (${files[0]}) without declaring it`);
    });

    expect(undeclared).toEqual([]);
  });

  it('has no cycle between packages, in what their shipped code imports', () => {
    const edges = new Map(
      usage.map(({ manifest, shipped }) => [manifest.name, [...shipped.keys()].filter(name => names.has(name))])
    );
    const cycles = [];
    const visit = (name, trail) => {
      const at = trail.indexOf(name);
      if (at !== -1) {
        cycles.push([...trail.slice(at), name].join(' → '));

        return;
      }

      for (const next of edges.get(name) ?? []) {
        visit(next, [...trail, name]);
      }
    };
    names.forEach(name => visit(name, []));

    expect([...new Set(cycles)]).toEqual([]);
  });

  it('exports a library package by its root and its folder barrels, nothing else', () => {
    // `sdk-authoring` is bundled into one file per entry, so its few entries are written by hand (checked below).
    const shape = {
      '.': { [SOURCE_CONDITION]: './src/index.ts', types: './dist/index.d.ts', import: './dist/index.mjs' },
      './*': { [SOURCE_CONDITION]: './src/*/index.ts', types: './dist/*/index.d.ts', import: './dist/*/index.mjs' }
    };
    const misshapen = packages
      .filter(({ dir }) => path.basename(path.dirname(dir)) === 'packages' && path.basename(dir) !== 'sdk-authoring')
      .filter(({ manifest }) => JSON.stringify(manifest.exports) !== JSON.stringify(shape))
      .map(({ manifest }) => `${manifest.name}: ${JSON.stringify(manifest.exports)}`);

    expect(misshapen).toEqual([]);
  });

  it('leads every entry written by hand with its source, and that source exists', () => {
    const problems = packages
      .filter(({ manifest }) => Object.keys(manifest.exports ?? {}).some(key => !key.includes('*')))
      .flatMap(({ dir, manifest }) =>
        Object.entries(manifest.exports ?? {})
          .filter(([key, target]) => !key.includes('*') && typeof target === 'object' && target !== null)
          .filter(([, target]) => 'import' in target && SOURCE_CONDITION in target)
          .flatMap(([key, target]) => {
            const source = target[SOURCE_CONDITION];
            if (Object.keys(target)[0] !== SOURCE_CONDITION) {
              return [`${manifest.name} "${key}" does not lead with "${SOURCE_CONDITION}"`];
            }

            return fs.existsSync(path.join(dir, source)) ? [] : [`${manifest.name} "${key}" → ${source}, not there`];
          })
      );

    expect(problems).toEqual([]);
  });

  it('runs every test of the workspace against the packages’ sources, never their last build', () => {
    // `e2e` and `bench` are the workspace's own harnesses; the examples are projects of a customer's, read as published.
    const harnesses = ['e2e', 'bench'].map(name => path.join(WORKSPACE, name));
    const testedDirs = [...packages.map(({ dir }) => dir), ...harnesses].filter(dir => {
      const manifest = path.join(dir, 'package.json');

      return fs.existsSync(manifest) && typeof readJson(manifest).scripts?.test === 'string';
    });
    const unresolved = testedDirs.flatMap(dir => {
      const config = ['vitest.config.ts', 'vite.config.ts'].map(name => path.join(dir, name)).find(fs.existsSync);
      if (!config) {
        return [`${path.relative(WORKSPACE, dir)} has a test script and no vite/vitest config`];
      }

      const text = fs.readFileSync(config, 'utf-8');
      const inheritsBase = text.includes("from '../sdk-shared/vite.config.ts'");

      return inheritsBase || text.includes(`'${SOURCE_CONDITION}'`)
        ? []
        : [`${path.relative(WORKSPACE, config)} does not resolve "${SOURCE_CONDITION}"`];
    });

    expect(unresolved).toEqual([]);
  });

  it('keeps the root of sdk-shared to the document types, so importing a type loads no runtime', () => {
    const root = fs.readFileSync(path.join(WORKSPACE, 'packages/sdk-shared/src/index.ts'), 'utf-8');
    const reexports = [...root.matchAll(/^export\b[^;]*;/gm)].map(([statement]) => statement);

    expect(reexports).toEqual(["export * from './types';"]);
  });

  it('has no cycle of value imports inside a library package', () => {
    /**
     * Known and harmless: the style editor's panels render each other (a selector opens a manager, which shows an
     * inspector, which lists selectors). They meet only while rendering, never while their modules load.
     */
    const allowed = new Set(['sdk-style:builder/components/Selector/Selector.tsx']);
    const fileOf = base =>
      ['', '.ts', '.tsx', '/index.ts', '/index.tsx']
        .map(suffix => base + suffix)
        .find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    const cycles = packages
      .filter(({ dir }) => path.basename(path.dirname(dir)) === 'packages')
      .flatMap(({ dir }) => {
        const src = path.join(dir, 'src');
        const files = sourceFiles(src).filter(file => !TEST_FILE.test(path.relative(dir, file)));
        const edges = new Map(
          files.map(file => {
            const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf-8'), ts.ScriptTarget.Latest, true);
            const targets = source.statements.flatMap(statement => {
              const declaration = ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement);
              const specifier = declaration ? statement.moduleSpecifier?.text : undefined;
              const typeOnly = ts.isImportDeclaration(statement)
                ? statement.importClause?.isTypeOnly ||
                  (statement.importClause?.namedBindings &&
                    ts.isNamedImports(statement.importClause.namedBindings) &&
                    !statement.importClause.name &&
                    statement.importClause.namedBindings.elements.every(element => element.isTypeOnly))
                : ts.isExportDeclaration(statement) && statement.isTypeOnly;
              const target =
                specifier?.startsWith('.') && !typeOnly
                  ? fileOf(path.resolve(path.dirname(file), specifier))
                  : undefined;

              return target ? [target] : [];
            });

            return [file, targets];
          })
        );
        // Tarjan: every strongly connected group of more than one file is a cycle.
        const found = [];
        const order = new Map();
        const low = new Map();
        const stack = [];
        let next = 0;
        const visit = file => {
          order.set(file, next);
          low.set(file, next++);
          stack.push(file);
          for (const target of edges.get(file) ?? []) {
            if (!order.has(target)) {
              visit(target);
              low.set(file, Math.min(low.get(file), low.get(target)));
            } else if (stack.includes(target)) {
              low.set(file, Math.min(low.get(file), order.get(target)));
            }
          }

          if (low.get(file) === order.get(file)) {
            const group = [];
            let member;
            do {
              member = stack.pop();
              group.push(path.relative(src, member));
            } while (member !== file);
            if (group.length > 1) {
              found.push(group.sort().map(member => `${path.basename(dir)}:${member}`));
            }
          }
        };
        files.forEach(file => order.has(file) || visit(file));

        return found.filter(group => !group.some(member => allowed.has(member))).map(group => group.join(' ↔ '));
      });

    expect(cycles).toEqual([]);
  });
});
