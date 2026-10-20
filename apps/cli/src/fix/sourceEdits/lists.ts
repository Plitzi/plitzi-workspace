import { callAt, findProperty, literalText, one, propsOfWritten, removeFromList, writtenNodeAt } from './ast';
import { calleeName, enclosingFunction, propertyValue, slotExpression } from './slots';

import type { EditOutcome, Node, Ts } from './ast';
import type { ValueSlot } from './slots';
import type { WrittenPosition } from '@plitzi/sdk-authoring';
import type TypeScript from 'typescript';

/**
 * A value that comes from a list's entry: edited in the entry a loop or a `map` draws it from — moved, removed, placed.
 */

/** An entry of a list a call is repeated for — `item.question` in `QUESTIONS.flatMap(item => …)` — and where it is. */
export interface ListEntryGiven {
  /** The list, by the name it is declared under. */
  list: string;
  /** The key of each entry the slot reads. */
  key: string;
  /** The module the file imports the list from, as written; absent when it is declared in the same file. */
  from?: string;
}

const LIST_METHODS = new Set(['map', 'flatMap', 'forEach']);

/** The module a file imports a name from, and the name it is exported under there. */
const importOf = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  name: string
): { from: string; exported: string } | undefined => {
  for (const statement of sourceFile.statements) {
    const bindings = ts.isImportDeclaration(statement) ? statement.importClause?.namedBindings : undefined;
    if (
      !bindings ||
      !ts.isNamedImports(bindings) ||
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue;
    }

    const element = bindings.elements.find(binding => binding.name.text === name);
    if (element) {
      return { from: statement.moduleSpecifier.text, exported: element.propertyName?.text ?? name };
    }
  }

  return undefined;
};

/** The list a call is repeated for — `LIST.map(item => …)` around it — with the name each entry is read by. */
export interface LoopAround {
  /** The list, by the name it is declared under. */
  list: string;
  /** The parameter each entry is read by inside. */
  item: string;
  /** The module the file imports the list from, as written; absent when it is declared in the same file. */
  from?: string;
}

const loopOf = (ts: Ts, sourceFile: TypeScript.SourceFile, from: Node, item?: string): LoopAround | undefined => {
  const fn = ts.findAncestor(
    from.parent,
    (ancestor): ancestor is TypeScript.ArrowFunction | TypeScript.FunctionExpression => {
      if (!ts.isArrowFunction(ancestor) && !ts.isFunctionExpression(ancestor)) {
        return false;
      }

      const first = ancestor.parameters.at(0);
      const looped = ancestor.parent;

      return (
        !!first &&
        ts.isIdentifier(first.name) &&
        (item === undefined || first.name.text === item) &&
        ts.isCallExpression(looped) &&
        ts.isPropertyAccessExpression(looped.expression) &&
        LIST_METHODS.has(looped.expression.name.text) &&
        ts.isIdentifier(looped.expression.expression)
      );
    }
  );
  const first = fn?.parameters.at(0);
  const looped = fn?.parent;
  if (
    !first ||
    !ts.isIdentifier(first.name) ||
    !looped ||
    !ts.isCallExpression(looped) ||
    !ts.isPropertyAccessExpression(looped.expression) ||
    !ts.isIdentifier(looped.expression.expression)
  ) {
    return undefined;
  }

  const name = looped.expression.expression.text;
  const imported = importOf(ts, sourceFile, name);

  return imported
    ? { list: imported.exported, item: first.name.text, from: imported.from }
    : { list: name, item: first.name.text };
};

/**
 * The list a call hands as a list element's rows — `items: PLANS` or `items: [...PLANS]` — with where it is declared:
 * what each row shows is an entry of it.
 */
export const itemsSource = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>
): { list: string; from?: string } | undefined => {
  const written = writtenNodeAt(ts, sourceFile, position);
  const props = written ? propsOfWritten(ts, written) : undefined;
  const value = props ? propertyValue(ts, findProperty(ts, props, 'items')) : undefined;
  const spread =
    value && ts.isArrayLiteralExpression(value) && value.elements.length === 1 ? value.elements[0] : undefined;
  const named =
    value && ts.isIdentifier(value)
      ? value
      : spread && ts.isSpreadElement(spread) && ts.isIdentifier(spread.expression)
        ? spread.expression
        : undefined;
  if (!named) {
    return undefined;
  }

  const imported = importOf(ts, sourceFile, named.text);

  return imported ? { list: imported.exported, from: imported.from } : { list: named.text };
};

/** The list the call at a position is repeated for, if it is written inside one's `map`. */
export const loopAround = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>
): LoopAround | undefined => {
  const written = writtenNodeAt(ts, sourceFile, position);

  return written ? loopOf(ts, sourceFile, written) : undefined;
};

/**
 * The list a slot reads an entry of: the call is written once inside `LIST.map(item => …)` and the value is
 * `item.key`, so what each element shows is written in the list, one entry per element.
 */
export const listEntryBehind = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>,
  slot: ValueSlot
): ListEntryGiven | undefined => {
  const written = writtenNodeAt(ts, sourceFile, position);
  const expression = written && slotExpression(ts, written, slot);
  if (
    !written ||
    !expression ||
    !ts.isPropertyAccessExpression(expression) ||
    !ts.isIdentifier(expression.expression)
  ) {
    return undefined;
  }

  const loop = loopOf(ts, sourceFile, written, expression.expression.text);

  return loop
    ? { list: loop.list, key: expression.name.text, ...(loop.from === undefined ? {} : { from: loop.from }) }
    : undefined;
};

/** A literal's value as the space reads it; nothing for anything that is not one. */
const literalValue = (ts: Ts, node: Node): string | number | boolean | undefined => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }

  if (ts.isNumericLiteral(node)) {
    return Number(node.text);
  }

  if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) {
    return node.kind === ts.SyntaxKind.TrueKeyword;
  }

  return undefined;
};

/** What a declaration holds under the `as const` and `satisfies` written around it. */
const unwrapped = (ts: Ts, expression: TypeScript.Expression): TypeScript.Expression =>
  ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression) || ts.isParenthesizedExpression(expression)
    ? unwrapped(ts, expression.expression)
    : expression;

/**
 * The one entry of a list whose `key` reads `current`, written over with `value`. Found by what it says now, the one
 * thing the element and its entry share: none, or more than one, is said and left to the author.
 */
export const listEntryEdit = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  entry: Pick<ListEntryGiven, 'list' | 'key'>,
  current: unknown,
  value: string | number | boolean | undefined
): EditOutcome => {
  const declaration = sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap(statement => [...statement.declarationList.declarations])
    .find(candidate => ts.isIdentifier(candidate.name) && candidate.name.text === entry.list);
  const list = declaration?.initializer ? unwrapped(ts, declaration.initializer) : undefined;
  if (!list || !ts.isArrayLiteralExpression(list)) {
    return { unplaced: `\`${entry.list}\` is not written as a list there` };
  }

  if (value === undefined) {
    return { unplaced: `it is \`${entry.key}\` of an entry of \`${entry.list}\`: take it out of the entry by hand` };
  }

  const matching = list.elements
    .filter(ts.isObjectLiteralExpression)
    .map(object => findProperty(ts, object, entry.key))
    .filter(
      (property): property is TypeScript.PropertyAssignment =>
        !!property && ts.isPropertyAssignment(property) && literalValue(ts, property.initializer) === current
    );
  if (matching.length !== 1) {
    return {
      unplaced:
        matching.length === 0
          ? `no entry of \`${entry.list}\` writes \`${entry.key}\` as ${JSON.stringify(current)}`
          : `${String(matching.length)} entries of \`${entry.list}\` write \`${entry.key}\` as ${JSON.stringify(current)}: change the one meant by hand`
    };
  }

  const { initializer } = matching[0];

  return one({ start: initializer.getStart(sourceFile), end: initializer.getEnd(), text: literalText(value) });
};

/**
 * The pages and layouts a file declares — an object with an `id` written as words and a `body` — each where its `{`
 * is: the place a page's attributes are edited at, since no factory call writes one.
 */
export const declaredRoots = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile
): { id: string; line: number; column: number }[] => {
  const found: { id: string; line: number; column: number }[] = [];
  const visit = (node: Node): void => {
    if (ts.isObjectLiteralExpression(node) && findProperty(ts, node, 'body')) {
      const id = findProperty(ts, node, 'id');
      if (
        id &&
        ts.isPropertyAssignment(id) &&
        (ts.isStringLiteral(id.initializer) || ts.isNoSubstitutionTemplateLiteral(id.initializer))
      ) {
        const at = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        found.push({ id: id.initializer.text, line: at.line + 1, column: at.character + 1 });
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return found;
};

/** Where a call sits among its siblings: the list of children it is an item of, and its place there. */
const placeInList = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>
): { list: TypeScript.ArrayLiteralExpression; call: TypeScript.CallExpression } | { unplaced: string } => {
  const call = callAt(ts, sourceFile, position.line, position.column);
  if (!call) {
    return { unplaced: 'the call that wrote it is not where it was' };
  }

  return ts.isArrayLiteralExpression(call.parent)
    ? { list: call.parent, call }
    : { unplaced: 'it is not written as an item of a list of children — it is held or handed on — so by hand' };
};

/**
 * Where an element is an item of a list of children: its own call, or — a section a helper builds and returns,
 * `body: [enterpriseFaq()]` — the call of the helper, named so the caller can follow it there.
 */
export const listItemAt = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>
): 'item' | { returnedBy: string } | { unplaced: string } => {
  const call = callAt(ts, sourceFile, position.line, position.column);
  if (!call) {
    return { unplaced: 'the call that wrote it is not where it was' };
  }

  if (ts.isArrayLiteralExpression(call.parent)) {
    return 'item';
  }

  const returned = (ts.isArrowFunction(call.parent) && call.parent.body === call) || ts.isReturnStatement(call.parent);
  const helper = returned ? enclosingFunction(ts, call) : undefined;

  return helper
    ? { returnedBy: helper.name }
    : { unplaced: 'it is not written as an item of a list of children — it is held or handed on — so by hand' };
};

/** Whether the call at a position is a call of the named function: the helper an element's own call is returned by. */
export const callsNamed = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>,
  name: string
): boolean => {
  const call = callAt(ts, sourceFile, position.line, position.column);

  return !!call && calleeName(ts, call) === name;
};

/** The element's call taken out of the list it is an item of, with the comma that went with it. */
export const removeItem = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>
): EditOutcome & { removed?: string } => {
  const placed = placeInList(ts, sourceFile, position);
  if ('unplaced' in placed) {
    return placed;
  }

  const index = placed.list.elements.indexOf(placed.call);

  return { ...one(removeFromList(sourceFile, placed.list.elements, index)), removed: placed.call.getText(sourceFile) };
};

/**
 * The element's call moved before or after a sibling in the same list, each item carried with the comments written
 * above it. Two lists are two places in the code: a move between them is the author's.
 */
export const moveItem = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>,
  sibling: Pick<WrittenPosition, 'line' | 'column'>,
  side: 'before' | 'after'
): EditOutcome => {
  const moving = placeInList(ts, sourceFile, position);
  const target = placeInList(ts, sourceFile, sibling);
  if ('unplaced' in moving) {
    return moving;
  }

  if ('unplaced' in target) {
    return { unplaced: `the element to move it ${side}: ${target.unplaced}` };
  }

  if (moving.list !== target.list) {
    return { unplaced: 'the two are not items of the same list of children: moving between them is by hand' };
  }

  const items = [...moving.list.elements].filter(item => item !== moving.call);
  const at = items.indexOf(target.call) + (side === 'after' ? 1 : 0);
  const ordered = [...items.slice(0, at), moving.call, ...items.slice(at)];
  const first = moving.list.elements[0];
  const last = moving.list.elements[moving.list.elements.length - 1];

  return one({
    start: first.getFullStart(),
    end: last.getEnd(),
    text: ordered.map(item => item.getFullText(sourceFile)).join(',')
  });
};
