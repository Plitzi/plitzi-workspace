import type { Node, TextChange, Ts } from './ast';

/**
 * The changes applied to the text, and the declarations an edit left unused pruned.
 */

/**
 * What a removal left behind in the file: each top-level, unexported `const x = styles(…)` among `names` that nothing
 * reads any longer — taken out, and named, so nothing goes unsaid. Anything else unread is the linter's to say.
 */
export const pruneDeclarations = (
  ts: Ts,
  fileName: string,
  text: string,
  names: readonly string[]
): { text: string; pruned: string[] } => {
  const sourceFile = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const reads = new Map<string, number>();
  const visit = (node: Node): void => {
    if (ts.isIdentifier(node) && !(ts.isVariableDeclaration(node.parent) && node.parent.name === node)) {
      reads.set(node.text, (reads.get(node.text) ?? 0) + 1);
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  const pruned: string[] = [];
  const changes: TextChange[] = [];
  for (const statement of sourceFile.statements) {
    const exported = ts.isVariableStatement(statement)
      ? statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
      : true;
    const declarations = ts.isVariableStatement(statement) ? statement.declarationList.declarations : undefined;
    const declaration = declarations?.length === 1 ? declarations[0] : undefined;
    const name = declaration && ts.isIdentifier(declaration.name) ? declaration.name.text : undefined;
    const initializer = declaration?.initializer;
    const isStyles =
      !!initializer &&
      ts.isCallExpression(initializer) &&
      ts.isIdentifier(initializer.expression) &&
      initializer.expression.text === 'styles';
    if (!exported && name && names.includes(name) && isStyles && !reads.get(name)) {
      // With its comments above it; the first of a file takes its line break too, so the file does not open blank.
      const start = statement.getFullStart();
      const end = statement.getEnd() + (start === 0 && text[statement.getEnd()] === '\n' ? 1 : 0);
      changes.push({ start, end, text: '' });
      pruned.push(name);
    }
  }

  return { text: applyChanges(text, changes) ?? text, pruned };
};

/** Every name a piece of code reads: what a removal may have left unread elsewhere in its file. */
export const namesIn = (ts: Ts, code: string): string[] => {
  const sourceFile = ts.createSourceFile('removed.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const names = new Set<string>();
  const visit = (node: Node): void => {
    if (ts.isIdentifier(node)) {
      names.add(node.text);
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return [...names];
};

/** The text with every change made — from the end back, so each span is where it was found. Overlaps are refused. */
export const applyChanges = (text: string, changes: readonly TextChange[]): string | undefined => {
  const ordered = [...changes].toSorted((a, b) => b.start - a.start);
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].end > ordered[index - 1].start) {
      return undefined;
    }
  }

  return ordered.reduce(
    (result, change) => result.slice(0, change.start) + change.text + result.slice(change.end),
    text
  );
};
