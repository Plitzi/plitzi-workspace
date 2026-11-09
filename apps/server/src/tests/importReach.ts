import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import ts from 'typescript';

const SRC = resolve(import.meta.dirname, '..');

const fileOf = (base: string): string | undefined =>
  [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')].find(
    candidate => existsSync(candidate) && statSync(candidate).isFile()
  );

/** Whether an import or a re-export loads nothing when it runs: types alone, erased. */
const onlyTypes = (statement: ts.ImportDeclaration | ts.ExportDeclaration): boolean => {
  if (ts.isImportDeclaration(statement)) {
    const clause = statement.importClause;
    const bindings = clause?.namedBindings;

    return (
      clause?.isTypeOnly === true ||
      (clause?.name === undefined &&
        bindings !== undefined &&
        ts.isNamedImports(bindings) &&
        bindings.elements.length > 0 &&
        bindings.elements.every(element => element.isTypeOnly))
    );
  }

  const clause = statement.exportClause;

  return (
    statement.isTypeOnly ||
    (clause !== undefined &&
      ts.isNamedExports(clause) &&
      clause.elements.length > 0 &&
      clause.elements.every(element => element.isTypeOnly))
  );
};

/** The specifiers a file loads when it runs, and its dynamic `import()`s, which load it later all the same. */
const loadedSpecifiers = (file: string): string[] => {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !onlyTypes(node)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }

    ts.forEachChild(node, visit);
  };
  visit(source);

  return specifiers;
};

/** The package a specifier names: `@plitzi/sdk-actions/worker` → `@plitzi/sdk-actions`. */
const packageOf = (specifier: string): string =>
  specifier
    .split('/')
    .slice(0, specifier.startsWith('@') ? 2 : 1)
    .join('/');

/**
 * What an entry (`index.ts`, `ssr.ts`) loads at run time: every file of this package, by its path under `src`, and every
 * package it imports from them.
 */
export const importReach = (entry: string): { files: string[]; packages: string[] } => {
  const seen = new Set<string>();
  const packages = new Set<string>();
  const pending = [join(SRC, entry)];
  while (pending.length > 0) {
    const file = pending.pop();
    if (file === undefined || seen.has(file)) {
      continue;
    }

    seen.add(file);
    for (const specifier of loadedSpecifiers(file)) {
      if (!specifier.startsWith('.')) {
        packages.add(packageOf(specifier));
        continue;
      }

      const next = fileOf(resolve(dirname(file), specifier));
      if (next) {
        pending.push(next);
      }
    }
  }

  return { files: [...seen].map(file => relative(SRC, file)).sort(), packages: [...packages].sort() };
};
