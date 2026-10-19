import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import ts from 'typescript';

/**
 * Every public barrel of every library package — its root and each `src/**\/index.ts`, all public through `"./*"` —
 * checked against what its build holds: each value the source exports must be exported by `dist/**\/index.mjs`.
 *
 * Rollup re-exports from a module it does not consider an entry only the bindings the package itself uses, and drops
 * the rest without a word: the declarations still list them, so a consumer typechecks and then fails at run time with
 * "does not provide an export named …". Run after a build (`yarn check:dist-exports`; CI runs it after `build:prod`).
 *
 * And what no published build may hold: the declarations of a test or a benchmark. Each app writes its own with its own
 * `dts({ exclude })`, and the one that forgot the tests shipped a `.test.d.ts` beside each of its modules.
 */

const WORKSPACE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
/** Bundled into one file per entry, with entries written by hand — not a package of folder barrels. */
const NOT_BARRELS = new Set(['sdk-authoring']);
/** What only tests use — their helpers, fakes and fixtures — lives in a `tests/` folder (`__mocks__`, Vitest's own). */
const NOT_SOURCE = new Set(['tests', '__mocks__']);

const barrelsUnder = dir =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return NOT_SOURCE.has(entry.name) ? [] : barrelsUnder(full);
    }

    return entry.name === 'index.ts' || entry.name === 'index.tsx' ? [full] : [];
  });

/** The names a built module exports, following its `export * from './…'` the way the runtime does (no default). */
const builtExports = (file, seen = new Set()) => {
  const names = new Set();
  if (seen.has(file) || !fs.existsSync(file)) {
    return names;
  }

  seen.add(file);
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf-8'), ts.ScriptTarget.Latest, true);
  for (const statement of source.statements) {
    const exported = ts.canHaveModifiers(statement)
      ? (ts.getModifiers(statement) ?? []).some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
      : false;
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        statement.exportClause.elements.forEach(element => names.add(element.name.text));
      } else if (!statement.exportClause && statement.moduleSpecifier?.text.startsWith('.')) {
        const target = path.resolve(path.dirname(file), statement.moduleSpecifier.text);
        builtExports(target, seen).forEach(name => name !== 'default' && names.add(name));
      }
    } else if (ts.isExportAssignment(statement)) {
      names.add('default');
    } else if (exported && ts.isVariableStatement(statement)) {
      statement.declarationList.declarations.forEach(declaration => {
        if (ts.isIdentifier(declaration.name)) {
          names.add(declaration.name.text);
        }
      });
    } else if (exported && 'name' in statement && statement.name && ts.isIdentifier(statement.name)) {
      const isDefault = (ts.getModifiers(statement) ?? []).some(
        modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword
      );
      names.add(isDefault ? 'default' : statement.name.text);
    }
  }

  return names;
};

/** The values a barrel's source exports, as TypeScript resolves them: type-only and ambient (`declare`) ones left out. */
const declaredValues = (checker, file) => {
  const symbol = checker.getSymbolAtLocation(file);
  if (!symbol) {
    return [];
  }

  return checker
    .getExportsOfModule(symbol)
    .filter(exported => {
      const typeOnly = (exported.declarations ?? []).some(
        declaration =>
          ts.isExportSpecifier(declaration) && (declaration.isTypeOnly || declaration.parent.parent.isTypeOnly)
      );
      if (typeOnly) {
        return false;
      }

      const target = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
      // `declare const X: unique symbol` and its kind are devices of the types: nothing of them exists at run time.
      const ambient = (target.declarations ?? []).every(
        declaration => (ts.getCombinedModifierFlags(declaration) & ts.ModifierFlags.Ambient) !== 0
      );

      return (target.flags & ts.SymbolFlags.Value) !== 0 && !ambient;
    })
    .map(exported => exported.name);
};

const problems = [];
let checked = 0;
for (const name of fs.readdirSync(path.join(WORKSPACE, 'packages')).filter(name => !NOT_BARRELS.has(name))) {
  const src = path.join(WORKSPACE, 'packages', name, 'src');
  if (!fs.existsSync(src)) {
    continue;
  }

  const barrels = barrelsUnder(src);
  const program = ts.createProgram(barrels, {
    allowJs: true,
    allowImportingTsExtensions: true,
    customConditions: ['@plitzi/source'],
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    resolveJsonModule: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2023
  });
  const checker = program.getTypeChecker();
  for (const barrel of barrels) {
    const relative = path.relative(src, barrel).replace(/\.tsx?$/, '.mjs');
    const built = path.join(WORKSPACE, 'packages', name, 'dist', relative);
    if (!fs.existsSync(built)) {
      problems.push(`@plitzi/${name}: dist/${relative} is not built`);
      continue;
    }

    const exported = builtExports(built);
    const missing = declaredValues(checker, program.getSourceFile(barrel)).filter(value => !exported.has(value));
    if (missing.length > 0) {
      problems.push(`@plitzi/${name}: dist/${relative} lacks ${missing.join(', ')}`);
    }

    checked++;
  }
}

const TEST_DECLARATION = /\.(test|bench|spec)\.d\.ts$|(^|\/)(tests|__mocks__)\//;
const filesUnder = dir =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap(entry => (entry.isDirectory() ? filesUnder(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));

const shipped = [];
for (const group of ['packages', 'apps']) {
  for (const name of fs.readdirSync(path.join(WORKSPACE, group))) {
    const manifest = path.join(WORKSPACE, group, name, 'package.json');
    const dist = path.join(WORKSPACE, group, name, 'dist');
    if (!fs.existsSync(manifest) || !fs.existsSync(dist) || JSON.parse(fs.readFileSync(manifest, 'utf-8')).private) {
      continue;
    }

    const tests = filesUnder(dist).filter(file => TEST_DECLARATION.test(path.relative(dist, file)));
    if (tests.length > 0) {
      shipped.push(`${group}/${name}: ${tests.length} (${path.relative(dist, tests[0])}…)`);
    }
  }
}

if (problems.length > 0) {
  console.error(`${problems.length} barrel(s) built without what their source exports:\n  ${problems.join('\n  ')}`);
  process.exitCode = 1;
} else {
  console.log(`✅ ${checked} barrels: every value their source exports is in dist`);
}

if (shipped.length > 0) {
  console.error(
    `A build holds the declarations of its tests — add '**/*.(test|bench).(ts|tsx)' and '**/tests/**' to its dts({ exclude }):\n  ${shipped.join('\n  ')}`
  );
  process.exitCode = 1;
} else {
  console.log('✅ no build holds the declarations of a test');
}
