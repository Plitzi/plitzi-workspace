import type { WrittenPosition } from '@plitzi/sdk-authoring';
import type TypeScript from 'typescript';

/**
 * The source as TypeScript reads it: the call, the object and the property an edit is about, and a change to its text.
 */

/** A span of the file's text, replaced. */
export interface TextChange {
  start: number;
  end: number;
  text: string;
}

/**
 * The changes an edit makes to the source — one span, or a few where it moves something (children that become an
 * attribute) — or why it makes none, and is left to the author, said.
 */
export type EditOutcome = { changes: TextChange[]; orphans?: string[] } | { unplaced: string };

export const one = (change: TextChange): EditOutcome => ({ changes: [change] });

export type Ts = typeof TypeScript;

export type Node = TypeScript.Node;

export type ObjectLiteral = TypeScript.ObjectLiteralExpression;

export type Property = TypeScript.ObjectLiteralElementLike;

// \x27 is the single quote: spelled so, it needs no quote of the other kind around it.
const SINGLE = '\x27';

export const quoted = (text: string): string =>
  `${SINGLE}${text.replace(/\\/g, '\\\\').replaceAll(SINGLE, `\\${SINGLE}`)}${SINGLE}`;

export const literalText = (value: string | number | boolean): string =>
  typeof value === 'string' ? quoted(value) : String(value);

export const keyText = (key: string): string => (/^[A-Za-z_$][\w$]*$/.test(key) ? key : quoted(key));

/** A property's name as written: `mode`, `'aria-label'`. */
export const nameOf = (ts: Ts, property: Property): string | undefined => {
  const name = property.name;
  if (!name) {
    return undefined;
  }

  return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) ? name.text : undefined;
};

export const findProperty = (ts: Ts, object: ObjectLiteral, key: string): Property | undefined =>
  object.properties.find(property => nameOf(ts, property) === key);

/**
 * Where an element's attributes are written besides its props themselves: `attributes: { … }`, and — for a component's
 * instance, whose attributes are the props it hands the component — `props: { … }`.
 */
export const ATTRIBUTE_HOLDERS: readonly string[] = ['attributes', 'props'];

/** The object literal a property holds, when it holds one: `attributes: { … }`, `params: { … }`. */
export const objectAt = (ts: Ts, object: ObjectLiteral, key: string): ObjectLiteral | undefined => {
  const property = findProperty(ts, object, key);

  return property && ts.isPropertyAssignment(property) && ts.isObjectLiteralExpression(property.initializer)
    ? property.initializer
    : undefined;
};

/** One item of a comma list taken out, with the comma that went with it. */
export const removeFromList = (
  sourceFile: TypeScript.SourceFile,
  items: readonly Node[],
  index: number
): TextChange => {
  const item = items[index];
  if (index < items.length - 1) {
    return { start: item.getStart(sourceFile), end: items[index + 1].getStart(sourceFile), text: '' };
  }

  if (index > 0) {
    return { start: items[index - 1].getEnd(), end: item.getEnd(), text: '' };
  }

  return { start: item.getStart(sourceFile), end: item.getEnd(), text: '' };
};

/** The call written at the factory's name: `container(` at that line and column, from 1. */
export const callAt = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  line: number,
  column: number
): TypeScript.CallExpression | undefined => {
  let found: TypeScript.CallExpression | undefined;
  const visit = (node: Node): void => {
    if (found) {
      return;
    }

    if (ts.isCallExpression(node)) {
      const callee = ts.isPropertyAccessExpression(node.expression) ? node.expression.name : node.expression;
      const at = sourceFile.getLineAndCharacterOfPosition(callee.getStart(sourceFile));
      if (at.line + 1 === line && at.character + 1 === column) {
        found = node;

        return;
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return found;
};

/** What wrote an element: a factory's call, or — a page, a layout — the object it is declared as. */
export type Written = TypeScript.CallExpression | ObjectLiteral;

/** The object literal that starts at a line and column, from 1: how a page or a layout is declared. */
const literalAt = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  line: number,
  column: number
): ObjectLiteral | undefined => {
  let found: ObjectLiteral | undefined;
  const visit = (node: Node): void => {
    if (found) {
      return;
    }

    if (ts.isObjectLiteralExpression(node)) {
      const at = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      if (at.line + 1 === line && at.character + 1 === column) {
        found = node;

        return;
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return found;
};

/** What is written at a position: the call a factory's name starts there, else the object literal that does. */
export const writtenNodeAt = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>
): Written | undefined =>
  callAt(ts, sourceFile, position.line, position.column) ?? literalAt(ts, sourceFile, position.line, position.column);

/** The props a factory call was handed: its last object literal — `text('Hi', { … })`, `container({ … })`. */
const propsOf = (ts: Ts, call: TypeScript.CallExpression): ObjectLiteral | undefined =>
  call.arguments.filter(ts.isObjectLiteralExpression).at(-1);

/** The props of what is written: a call's, or the declared object itself. */
export const propsOfWritten = (ts: Ts, written: Written): ObjectLiteral | undefined =>
  ts.isCallExpression(written) ? propsOf(ts, written) : written;

/**
 * The object a step was written with: itself when it is a literal, a builder's own props (`setState({ … })`), or —
 * through a wrapper (`named('x', …)`, `when(rule, …)`) — the step it wraps, which is its last argument.
 */
const stepObject = (ts: Ts, expression: TypeScript.Expression): ObjectLiteral | undefined => {
  if (ts.isObjectLiteralExpression(expression)) {
    return expression;
  }

  if (!ts.isCallExpression(expression)) {
    return undefined;
  }

  const last = expression.arguments.at(-1);
  if (last && ts.isCallExpression(last)) {
    return stepObject(ts, last);
  }

  return expression.arguments.filter(ts.isObjectLiteralExpression).at(-1);
};

export const stepIn = (ts: Ts, props: ObjectLiteral, flow: number, index: number): ObjectLiteral | undefined => {
  const flows = findProperty(ts, props, 'flows');
  if (!flows || !ts.isPropertyAssignment(flows) || !ts.isArrayLiteralExpression(flows.initializer)) {
    return undefined;
  }

  const steps = flows.initializer.elements.at(flow);
  const step = steps && ts.isArrayLiteralExpression(steps) ? steps.elements.at(index) : undefined;

  return step ? stepObject(ts, step) : undefined;
};

export const isLiteral = (ts: Ts, node: Node): boolean =>
  ts.isStringLiteral(node) ||
  ts.isNoSubstitutionTemplateLiteral(node) ||
  ts.isNumericLiteral(node) ||
  node.kind === ts.SyntaxKind.TrueKeyword ||
  node.kind === ts.SyntaxKind.FalseKeyword ||
  node.kind === ts.SyntaxKind.NullKeyword;

/** `key: value` added to an object literal, after what it already holds. */
export const insertInto = (
  sourceFile: TypeScript.SourceFile,
  object: ObjectLiteral,
  key: string,
  value: string
): TextChange => {
  const last = object.properties.at(-1);
  if (!last) {
    return { start: object.getStart(sourceFile), end: object.getEnd(), text: `{ ${keyText(key)}: ${value} }` };
  }

  return { start: last.getEnd(), end: last.getEnd(), text: `, ${keyText(key)}: ${value}` };
};
