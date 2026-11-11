import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { CLI_ROOT } from './tests/roots';

/**
 * What every command loads before it runs: the modules `src/index.ts` reaches by static value imports. The build puts
 * them in the chunks `index.js` imports, and what is reached only through `import()` in chunks of their own — the run's
 * commands (`commands/runs/register/commands.ts`) and the harness beneath them, which `plitzi --version`, a page
 * check or a lint never read.
 */
const SRC = path.join(CLI_ROOT, 'src');

/**
 * The harness's modules a command of one agent still loads: the constants the run's commands are registered with —
 * their options' choices and their help. Anything else of `runs/` belongs behind `runCommands()`, or out of `runs/`.
 */
const REGISTERED_WITH = ['runs/findings/plitziClass.ts', 'runs/findings/words.ts', 'runs/report/experience.ts'];

const resolve = (from: string, specifier: string): string | undefined => {
  const base = path.resolve(path.dirname(from), specifier);

  return [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), base].find(
    candidate => existsSync(candidate) && candidate.endsWith('.ts')
  );
};

/**
 * The module a statement loads: an import or a re-export that is not `type` alone. `import { type A }` still loads its
 * module — `verbatimModuleSyntax` keeps it as `import {}`.
 */
const loadedBy = (statement: ts.Statement): ts.Expression | undefined => {
  if (ts.isImportDeclaration(statement)) {
    return statement.importClause?.isTypeOnly ? undefined : statement.moduleSpecifier;
  }

  if (ts.isExportDeclaration(statement)) {
    return statement.isTypeOnly ? undefined : statement.moduleSpecifier;
  }

  return undefined;
};

/** The relative modules a file loads: its value imports and re-exports — never `import type`, never `import()`. */
const loads = (file: string): string[] => {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest);
  const specifiers: string[] = [];
  for (const statement of source.statements) {
    const specifier = loadedBy(statement);
    if (specifier && ts.isStringLiteral(specifier)) {
      specifiers.push(specifier.text);
    }
  }

  return specifiers
    .filter(specifier => specifier.startsWith('.'))
    .map(specifier => resolve(file, specifier))
    .filter((module): module is string => module !== undefined);
};

const loadedAtStart = (): Set<string> => {
  const seen = new Set<string>();
  const queue = [path.join(SRC, 'index.ts')];
  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    if (seen.has(file)) {
      continue;
    }

    seen.add(file);
    queue.push(...loads(file));
  }

  return new Set([...seen].map(file => path.relative(SRC, file)));
};

describe('what a command loads before it runs', () => {
  const loaded = loadedAtStart();

  it('is the CLI, its commands registered — and none of the harness but what they are registered with', () => {
    expect(loaded.has('program.ts')).toBe(true);
    expect(loaded.has('commands/runs/register/index.ts')).toBe(true);
    expect([...loaded].filter(module => module.startsWith('runs/')).sort()).toEqual(REGISTERED_WITH);
  });

  it('loads no run command until one runs', () => {
    const commands = [...loaded].filter(
      module => module.startsWith('commands/runs/') && !module.startsWith('commands/runs/register/')
    );

    expect(commands).toEqual([]);
  });
});
