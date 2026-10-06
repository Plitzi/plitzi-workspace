import { eachNode, isPlainString, placeOf } from '../ast';
import { finding } from '../catalog';

import type { LintFinding, Rule } from '../types';
import type TypeScript from 'typescript';

/** The fields a row is known by: comparing one of them to a value singles out one row. */
const IDENTITY = new Set(['id', 'key', 'slug', 'name', 'title', 'label']);

const isEquality = (ts: typeof TypeScript, kind: TypeScript.SyntaxKind): boolean =>
  kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
  kind === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
  kind === ts.SyntaxKind.EqualsEqualsToken ||
  kind === ts.SyntaxKind.ExclamationEqualsToken;

/** The names in the callback that stand for a row's identity: `item` (read as `item.id`), or a destructured `id`. */
interface RowNames {
  row?: string;
  fields: Set<string>;
}

const rowNamesOf = (ts: typeof TypeScript, parameter: TypeScript.ParameterDeclaration | undefined): RowNames => {
  if (!parameter) {
    return { fields: new Set() };
  }

  if (ts.isIdentifier(parameter.name)) {
    return { row: parameter.name.text, fields: new Set() };
  }

  if (ts.isObjectBindingPattern(parameter.name)) {
    const fields = parameter.name.elements.flatMap(element => {
      const field =
        element.propertyName && ts.isIdentifier(element.propertyName) ? element.propertyName.text : undefined;
      const local = ts.isIdentifier(element.name) ? element.name.text : undefined;

      return local !== undefined && IDENTITY.has(field ?? local) ? [local] : [];
    });

    return { fields: new Set(fields) };
  }

  return { fields: new Set() };
};

/** `item.id`, or a destructured `id`: a read of the row's identity. */
const readsIdentity = (ts: typeof TypeScript, node: TypeScript.Expression, names: RowNames): boolean =>
  (ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === names.row &&
    IDENTITY.has(node.name.text)) ||
  (ts.isIdentifier(node) && names.fields.has(node.text));

const isValue = (ts: typeof TypeScript, node: TypeScript.Expression): node is TypeScript.LiteralExpression =>
  isPlainString(ts, node) || ts.isNumericLiteral(node);

/** Where a callback singles rows out: each value one of its identity fields is compared to, and the comparison. */
interface SingledOut {
  value: string;
  node: TypeScript.Node;
}

const singledOut = (
  ts: typeof TypeScript,
  callback: TypeScript.ArrowFunction | TypeScript.FunctionExpression
): SingledOut[] => {
  const names = rowNamesOf(ts, callback.parameters.at(0));
  if (names.row === undefined && names.fields.size === 0) {
    return [];
  }

  const found: SingledOut[] = [];
  eachNode(ts, callback.body, node => {
    if (ts.isBinaryExpression(node) && isEquality(ts, node.operatorToken.kind)) {
      const { left, right } = node;
      if (readsIdentity(ts, left, names) && isValue(ts, right)) {
        found.push({ value: right.text, node });
      } else if (readsIdentity(ts, right, names) && isValue(ts, left)) {
        found.push({ value: left.text, node });
      }
    } else if (ts.isSwitchStatement(node) && readsIdentity(ts, node.expression, names)) {
      for (const clause of node.caseBlock.clauses) {
        if (ts.isCaseClause(clause) && isValue(ts, clause.expression)) {
          found.push({ value: clause.expression.text, node: clause });
        }
      }
    }
  });

  return found;
};

export const specialCaseInMap: Rule = ({ ts, files }) =>
  files.flatMap(source => {
    const found: LintFinding[] = [];
    eachNode(ts, source.sourceFile, node => {
      if (
        !ts.isCallExpression(node) ||
        !ts.isPropertyAccessExpression(node.expression) ||
        !['map', 'flatMap'].includes(node.expression.name.text)
      ) {
        return;
      }

      const callback = node.arguments.at(0);
      if (!callback || !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
        return;
      }

      const singled = singledOut(ts, callback);
      if (singled.length === 0) {
        return;
      }

      const values = [...new Set(singled.map(each => each.value))];

      found.push(
        finding(
          'special-case-in-map',
          `The map singles out ${values.map(value => `“${value}”`).join(', ')} by name: put what differs in that row's data — an optional field (\`badge\`, \`href\`, \`variant\`) every row may have — and read it in the map, so a new row needs no new \`if\`.`,
          placeOf(source, singled[0].node)
        )
      );
    });

    return found;
  });
