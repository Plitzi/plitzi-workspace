import path from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { explain } from './explain';

/** The values the package exports with neither a doc comment of their own nor an entry `explain` answers. */
const unexplained = (): string[] => {
  const entry = path.join(import.meta.dirname, 'index.ts');
  const program = ts.createProgram([entry], {
    noEmit: true,
    skipLibCheck: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowImportingTsExtensions: true
  });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(entry);
  const module = source ? checker.getSymbolAtLocation(source) : undefined;
  if (!module) {
    throw new Error('the package entry is not a module');
  }

  return checker.getExportsOfModule(module).flatMap(exported => {
    const declared = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
    const first = declared.declarations?.[0];
    if (!first || !(declared.flags & (ts.SymbolFlags.Function | ts.SymbolFlags.Variable))) {
      return [];
    }

    const file = first.getSourceFile();
    const statement = file.statements.find(each => each.pos <= first.pos && first.end <= each.end);
    const leading = statement ? file.text.slice(statement.getFullStart(), statement.getStart(file)) : '';

    return /\/\*\*[\s\S]*?\*\//.test(leading) || explain(exported.name).length > 0 ? [] : [exported.name];
  });
};

// `plitzi explain defineAction` answered its signature alone — no doc, no example — and an agent read the
// package's types 25 times to learn what an action takes. `explain` prints an export's doc: every one has something.
describe('what the package exports', () => {
  it('says what each value is: a doc comment of its own, or what explain answers for it', () => {
    expect(unexplained()).toEqual([]);
  });
});
