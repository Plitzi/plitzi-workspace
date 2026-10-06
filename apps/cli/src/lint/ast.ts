import type { SourcePlace, SpaceSourceFile } from './types';
import type TypeScript from 'typescript';

type Ts = typeof TypeScript;

/** Every node of the file, depth first. */
export const eachNode = (ts: Ts, root: TypeScript.Node, visit: (node: TypeScript.Node) => void): void => {
  const walk = (node: TypeScript.Node): void => {
    visit(node);
    ts.forEachChild(node, walk);
  };
  walk(root);
};

/** Where a node starts, from 1. */
export const placeOf = (source: SpaceSourceFile, node: TypeScript.Node): SourcePlace => {
  const { line, character } = source.sourceFile.getLineAndCharacterOfPosition(node.getStart(source.sourceFile));

  return { file: source.file, line: line + 1, column: character + 1 };
};

/** The line a node ends on, from 1. */
export const endLineOf = (source: SpaceSourceFile, node: TypeScript.Node): number =>
  source.sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;

/** A property's name as written — `mode`, `'aria-label'` — or nothing for a computed one. */
export const propertyName = (ts: Ts, name: TypeScript.PropertyName | undefined): string | undefined => {
  if (!name) {
    return undefined;
  }

  return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) ? name.text : undefined;
};

/** The property of an object literal named `key`, when it is written as `key: value`. */
export const propertyValue = (
  ts: Ts,
  object: TypeScript.ObjectLiteralExpression,
  key: string
): TypeScript.Expression | undefined => {
  for (const property of object.properties) {
    if (ts.isPropertyAssignment(property) && propertyName(ts, property.name) === key) {
      return property.initializer;
    }
  }

  return undefined;
};

/** A string the source writes as it is: `'a'`, `"a"` or a template with nothing in it. */
export const isPlainString = (
  ts: Ts,
  node: TypeScript.Node
): node is TypeScript.StringLiteral | TypeScript.NoSubstitutionTemplateLiteral =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);

/**
 * A value written out in full — a string, a number, a boolean, `null`, or a list or an object of those — which is
 * what data is, as opposed to code that computes it.
 */
export const isLiteralValue = (ts: Ts, node: TypeScript.Expression): boolean => {
  if (
    isPlainString(ts, node) ||
    ts.isNumericLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword
  ) {
    return true;
  }

  if (ts.isPrefixUnaryExpression(node)) {
    return ts.isNumericLiteral(node.operand);
  }

  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) {
    return isLiteralValue(ts, node.expression);
  }

  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.every(element => isLiteralValue(ts, element));
  }

  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.every(
      property => ts.isPropertyAssignment(property) && isLiteralValue(ts, property.initializer)
    );
  }

  return false;
};

/** The names of the properties and the variables a node is written under, innermost first: `css`, `light`, `tokens`. */
export const enclosingNames = (ts: Ts, node: TypeScript.Node): string[] => {
  const names: string[] = [];
  for (let at = node.parent; !ts.isSourceFile(at); at = at.parent) {
    if (ts.isPropertyAssignment(at)) {
      const name = propertyName(ts, at.name);
      if (name !== undefined) {
        names.push(name);
      }
    } else if (ts.isVariableDeclaration(at) && ts.isIdentifier(at.name)) {
      names.push(at.name.text);
    }
  }

  return names;
};
