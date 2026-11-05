import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import ts from 'typescript';

/** What a value import of a file leads to, at run time: the files of this package it loads, and the packages. */
export type ImportReach = { files: string[]; packages: Map<string, string> };

const SRC = resolve(import.meta.dirname, '..');

const fileOf = (base: string): string | undefined =>
  [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')].find(
    candidate => existsSync(candidate) && statSync(candidate).isFile()
  );

/** The specifiers a file loads when it runs: every import and re-export but those that are types alone. */
const valueSpecifiers = (file: string): string[] => {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);

  return source.statements.flatMap(statement => {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      const bindings = clause?.namedBindings;
      const onlyTypes =
        clause?.isTypeOnly === true ||
        (clause?.name === undefined &&
          bindings !== undefined &&
          ts.isNamedImports(bindings) &&
          bindings.elements.length > 0 &&
          bindings.elements.every(element => element.isTypeOnly));

      return onlyTypes || !ts.isStringLiteral(statement.moduleSpecifier) ? [] : [statement.moduleSpecifier.text];
    }

    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      const clause = statement.exportClause;
      const onlyTypes =
        statement.isTypeOnly ||
        (clause !== undefined &&
          ts.isNamedExports(clause) &&
          clause.elements.length > 0 &&
          clause.elements.every(element => element.isTypeOnly));

      return onlyTypes ? [] : [statement.moduleSpecifier.text];
    }

    return [];
  });
};

/**
 * Follows the value imports of a folder of this package (`functions`), through this package's own files, and answers
 * the packages it reaches and which file reached each first. Node's own modules count as packages too (`node:fs`).
 */
export const importReach = (folder: string): ImportReach => {
  const entry = fileOf(join(SRC, folder));
  if (!entry) {
    throw new Error(`No folder "${folder}" with an index in sdk-shared's src`);
  }

  const seen = new Set<string>();
  const packages = new Map<string, string>();
  const pending = [entry];
  while (pending.length) {
    const file = pending.pop();
    if (file === undefined || seen.has(file)) {
      continue;
    }

    seen.add(file);
    for (const specifier of valueSpecifiers(file)) {
      if (specifier.startsWith('.')) {
        const next = fileOf(resolve(dirname(file), specifier));
        if (next) {
          pending.push(next);
        }

        continue;
      }

      const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
      if (!packages.has(name)) {
        packages.set(name, relative(SRC, file));
      }
    }
  }

  return { files: [...seen].map(file => relative(SRC, file)).sort(), packages };
};
