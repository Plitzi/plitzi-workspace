import {
  ATTRIBUTE_HOLDERS,
  callAt,
  findProperty,
  isLiteral,
  literalText,
  objectAt,
  one,
  propsOfWritten,
  writtenNodeAt
} from './ast';
import { attributeEdit, wordsOf } from './attributes';
import { editKey } from './keys';

import type { EditOutcome, Node, Property, Ts, Written } from './ast';
import type { WrittenPosition } from '@plitzi/sdk-authoring';
import type TypeScript from 'typescript';

/**
 * A value that comes from a parameter: edited where the function is called with it.
 */

/** A value handed to a helper: by its place among the arguments, and by its key when they are one object of props. */
export interface ArgumentSlot {
  helper: string;
  argument: number;
  key?: string;
}

/** Where a value is written in a call: an attribute of the element a factory writes, or an argument of a helper. */
export type ValueSlot = { attribute: string } | ArgumentSlot;

/** A value written as a parameter of the helper the call is in, and where the helper's caller hands it. */
export interface ParameterGiven {
  name: string;
  slot: ArgumentSlot;
  /** How many times the helper reads it: more than once, what is handed there is more than this one value. */
  uses: number;
}

export const calleeName = (ts: Ts, call: TypeScript.CallExpression): string | undefined => {
  const callee = ts.isPropertyAccessExpression(call.expression) ? call.expression.name : call.expression;

  return ts.isIdentifier(callee) ? callee.text : undefined;
};

/** What a property holds as written: its value, or the name a shorthand reads. */
export const propertyValue = (ts: Ts, property: Property | undefined): TypeScript.Expression | undefined => {
  if (property && ts.isPropertyAssignment(property)) {
    return property.initializer;
  }

  return property && ts.isShorthandPropertyAssignment(property) ? property.name : undefined;
};

/** The expression a slot is written as in a call: nothing when the call does not write it. */
export const slotExpression = (ts: Ts, written: Written, slot: ValueSlot): TypeScript.Expression | undefined => {
  if ('attribute' in slot) {
    const words = slot.attribute === 'content' && ts.isCallExpression(written) ? wordsOf(ts, written) : undefined;
    const props = propsOfWritten(ts, written);
    const holders = props
      ? [props, ...ATTRIBUTE_HOLDERS.map(key => objectAt(ts, props, key)).filter(inner => inner !== undefined)]
      : [];

    return (
      words ??
      propertyValue(
        ts,
        holders.map(holder => findProperty(ts, holder, slot.attribute)).find(property => property !== undefined)
      )
    );
  }

  const argument =
    ts.isCallExpression(written) && calleeName(ts, written) === slot.helper
      ? written.arguments.at(slot.argument)
      : undefined;
  if (!argument || slot.key === undefined) {
    return argument;
  }

  return ts.isObjectLiteralExpression(argument) ? propertyValue(ts, findProperty(ts, argument, slot.key)) : undefined;
};

type FunctionLike = TypeScript.ArrowFunction | TypeScript.FunctionExpression | TypeScript.FunctionDeclaration;

/** The function a call is written in, and the name it is called by — a declaration's, or the variable's it is held in. */
export const enclosingFunction = (ts: Ts, node: Node): { fn: FunctionLike; name: string } | undefined => {
  const at = ts.findAncestor(
    node.parent,
    (ancestor): ancestor is FunctionLike =>
      ts.isArrowFunction(ancestor) || ts.isFunctionExpression(ancestor) || ts.isFunctionDeclaration(ancestor)
  );
  if (!at) {
    return undefined;
  }

  const holder = at.parent;
  const name = ts.isFunctionDeclaration(at)
    ? at.name?.text
    : ts.isVariableDeclaration(holder) && ts.isIdentifier(holder.name)
      ? holder.name.text
      : undefined;

  return name === undefined ? undefined : { fn: at, name };
};

/** Every place the function reads a name: never a key written beside a value, nor a property of something else. */
const readsOf = (ts: Ts, fn: FunctionLike, name: string): number => {
  let reads = 0;
  const visit = (node: Node): void => {
    const parent = node.parent;
    const isKey =
      (ts.isPropertyAssignment(parent) && parent.name === node) ||
      (ts.isPropertyAccessExpression(parent) && parent.name === node);
    if (ts.isIdentifier(node) && node.text === name && !isKey) {
      reads += 1;
    }

    ts.forEachChild(node, visit);
  };
  if (fn.body) {
    visit(fn.body);
  }

  return reads;
};

/**
 * The parameter of the helper a call is in that a slot is written as — `heading(title, { … })` inside
 * `pageHead(id, kicker, title, line)` — and where its caller hands it: the value the visitor reads is decided there.
 */
export const parameterBehind = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>,
  slot: ValueSlot
): ParameterGiven | undefined => {
  const written = writtenNodeAt(ts, sourceFile, position);
  const expression = written && slotExpression(ts, written, slot);
  const helper = written && expression && ts.isIdentifier(expression) ? enclosingFunction(ts, written) : undefined;
  if (!helper || !expression || !ts.isIdentifier(expression)) {
    return undefined;
  }

  const name = expression.text;
  for (const [argument, parameter] of helper.fn.parameters.entries()) {
    if (ts.isIdentifier(parameter.name) && parameter.name.text === name) {
      return { name, slot: { helper: helper.name, argument }, uses: readsOf(ts, helper.fn, name) };
    }

    const element = ts.isObjectBindingPattern(parameter.name)
      ? parameter.name.elements.find(
          binding => !binding.dotDotDotToken && ts.isIdentifier(binding.name) && binding.name.text === name
        )
      : undefined;
    if (element) {
      const key = element.propertyName && ts.isIdentifier(element.propertyName) ? element.propertyName.text : name;

      return { name, slot: { helper: helper.name, argument, key }, uses: readsOf(ts, helper.fn, name) };
    }
  }

  return undefined;
};

/** A value set — or removed — where a slot is written: an element's attribute, or what a helper's caller hands it. */
export const slotEdit = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>,
  slot: ValueSlot,
  value: string | number | boolean | undefined
): EditOutcome => {
  if ('attribute' in slot) {
    return attributeEdit(ts, sourceFile, position, slot.attribute, value);
  }

  const call = callAt(ts, sourceFile, position.line, position.column);
  if (!call || calleeName(ts, call) !== slot.helper) {
    return { unplaced: `\`${slot.helper}(…)\` is not called where it was` };
  }

  if (value === undefined) {
    return { unplaced: `it is handed to \`${slot.helper}\` there: take it out of the call by hand` };
  }

  const argument = call.arguments.at(slot.argument);
  if (!argument) {
    return { unplaced: `\`${slot.helper}\` is not handed it there` };
  }

  if (slot.key !== undefined) {
    return ts.isObjectLiteralExpression(argument)
      ? editKey(ts, sourceFile, argument, [], { on: 'field', op: 'set', key: slot.key, value })
      : {
          unplaced: `\`${slot.helper}\` is handed \`${argument.getText(sourceFile)}\` there: change it where that is given`
        };
  }

  return isLiteral(ts, argument)
    ? one({ start: argument.getStart(sourceFile), end: argument.getEnd(), text: literalText(value) })
    : {
        unplaced: `\`${slot.helper}\` is handed \`${argument.getText(sourceFile)}\` there: change it where that is given`
      };
};

/** How a slot is written in a call, and whether that is a value an edit can write over. */
export const slotText = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>,
  slot: ValueSlot
): { text: string; literal: boolean } | undefined => {
  const written = writtenNodeAt(ts, sourceFile, position);
  const expression = written && slotExpression(ts, written, slot);

  return expression ? { text: expression.getText(sourceFile), literal: isLiteral(ts, expression) } : undefined;
};
