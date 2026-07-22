import { filters, isRawMarker, unwrapRaw } from '../twigWrapper/filters/filters';

import type { ASTNode, Expression, IfNode, ForNode, SetNode, ApplyNode, VariableNode } from './AST';

// Evaluator: walks the AST and produces a string output.
// Each node type has a dedicated handler. The evaluator is stateless —
// context is passed through and mutated only by {% set %} nodes.

export type EvalResult = {
  readonly output: string;
  readonly variables: Record<string, unknown>;
};

// Resolves a collection value into an array of items.
const resolveCollection = (value: unknown): unknown[] | null => {
  if (Array.isArray(value)) {
    return value as unknown[];
  }
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>);
  }
  return null;
};

// Resolves an object collection into [key, value] pairs for `{% for key, value in obj %}`.
const resolveObjectEntries = (value: unknown): [string, unknown][] | null => {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>);
  }
  return null;
};

export const evaluate = (
  nodes: readonly ASTNode[],
  context: Record<string, unknown>,
  keepEmptyTokens = false
): EvalResult => {
  const ctx = new Evaluator(context, keepEmptyTokens);
  const output = ctx.evalNodes(nodes);
  return { output, variables: ctx.variables };
};

class Evaluator {
  readonly variables: Record<string, unknown>;
  private readonly keepEmptyTokens: boolean;
  private breakFlag = false;
  private continueFlag = false;

  constructor(context: Record<string, unknown>, keepEmptyTokens = false) {
    this.variables = { ...context };
    this.keepEmptyTokens = keepEmptyTokens;
  }

  // ── Node Evaluation ──────────────────────────────────────────────────────

  evalNodes(nodes: readonly ASTNode[]): string {
    // Fast path for single-node arrays (most common in simple interpolation).
    if (nodes.length === 1) {
      return this.evalNode(nodes[0]);
    }
    const parts: string[] = [];
    for (let i = 0; i < nodes.length; i++) {
      parts.push(this.evalNode(nodes[i]));
    }
    return parts.join('');
  }

  private evalNode(node: ASTNode): string {
    switch (node.type) {
      case 'text':
        return node.value;
      case 'variable':
        return this.evalVariable(node);
      case 'if':
        return this.evalIf(node);
      case 'for':
        return this.evalFor(node);
      case 'set':
        return this.evalSet(node);
      case 'apply':
        return this.evalApply(node);
      case 'break':
        this.breakFlag = true;
        return '';
      case 'continue':
        this.continueFlag = true;
        return '';
    }
  }

  private evalVariable(node: VariableNode): string {
    const value = this.evalExpression(node.expression);

    // keepEmptyTokens: preserve original token text for missing/empty values.
    if (this.keepEmptyTokens && (value === undefined || value === null || value === '')) {
      return node.source;
    }

    // Fast path: non-object, non-null/undefined value (most common case).
    if (value !== null && value !== undefined && typeof value !== 'object') {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      return String(value);
    }

    // Raw mode (triple braces): output as toString.
    if (node.raw) {
      if (value === null || value === undefined) {
        return '';
      }
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      return String(value);
    }

    // Normal mode (double braces): JSON-serialize objects, empty string for null/undefined.
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    return '';
  }

  private evalIf(node: IfNode): string {
    const condValue = this.evalExpression(node.condition);
    if (isTruthy(condValue)) {
      return this.evalNodes(node.body);
    }

    for (const elif of node.elseifClauses) {
      const elifValue = this.evalExpression(elif.condition);
      if (isTruthy(elifValue)) {
        return this.evalNodes(elif.body);
      }
    }

    if (node.elseBody) {
      return this.evalNodes(node.elseBody);
    }

    return '';
  }

  private evalFor(node: ForNode): string {
    const collection = this.evalExpression(node.collection);
    const parts: string[] = [];

    // Handle object iteration with key, value syntax.
    if (node.keyVar) {
      const entries = resolveObjectEntries(collection);
      if (!entries || entries.length === 0) {
        if (node.elseBody) {
          return this.evalNodes(node.elseBody);
        }
        return '';
      }

      const parentLoop = this.variables['loop'];
      for (let i = 0; i < entries.length; i++) {
        const [key, value] = entries[i];
        this.variables['loop'] = {
          index: i + 1,
          index0: i,
          first: i === 0,
          last: i === entries.length - 1,
          length: entries.length,
          revindex: entries.length - i
        };
        this.variables[node.keyVar] = key;
        this.variables[node.valueVar] = value;

        const body = this.evalNodes(node.body);
        if (this.breakFlag) {
          this.breakFlag = false;
          break;
        }
        if (this.continueFlag) {
          this.continueFlag = false;
          continue;
        }
        parts.push(body);
      }

      if (parentLoop !== undefined) {
        this.variables['loop'] = parentLoop;
      } else {
        delete this.variables['loop'];
      }
      return parts.join('');
    }

    // Array/simple iteration.
    const items = resolveCollection(collection);
    if (!items || items.length === 0) {
      if (node.elseBody) {
        return this.evalNodes(node.elseBody);
      }
      return '';
    }

    const parentLoop = this.variables['loop'];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      this.variables['loop'] = {
        index: i + 1,
        index0: i,
        first: i === 0,
        last: i === items.length - 1,
        length: items.length,
        revindex: items.length - i
      };
      this.variables[node.valueVar] = item;

      const body = this.evalNodes(node.body);
      if (this.breakFlag) {
        this.breakFlag = false;
        break;
      }
      if (this.continueFlag) {
        this.continueFlag = false;
        continue;
      }
      parts.push(body);
    }

    if (parentLoop !== undefined) {
      this.variables['loop'] = parentLoop;
    } else {
      delete this.variables['loop'];
    }
    return parts.join('');
  }

  private evalSet(node: SetNode): string {
    if (Array.isArray(node.value)) {
      // Block set: `{% set var %}...{% endset %}`
      const body = this.evalNodes(node.value);
      this.variables[node.name] = body;
    } else {
      // Assignment set: `{% set var = expr %}`
      this.variables[node.name] = this.evalExpression(node.value);
    }
    return '';
  }

  private evalApply(node: ApplyNode): string {
    const body = this.evalNodes(node.body);
    let value: unknown = body;

    for (const filterCall of node.filters) {
      const fn = filters[filterCall.name];
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (fn !== undefined) {
        value = fn(value, filterCall.arg ?? undefined, this.variables);
      }
    }

    // Serialize result.
    if (isRawMarker(value)) {
      return String(unwrapRaw(value));
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    if (value === null || value === undefined) {
      return '';
    }
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return String(value);
  }

  // ── Expression Evaluation ────────────────────────────────────────────────

  evalExpression(expr: Expression): unknown {
    switch (expr.type) {
      case 'literal':
        return expr.value;
      case 'array':
        return expr.elements.map(e => this.evalExpression(e));
      case 'range':
        return this.evalRange(expr);
      case 'path':
        return this.resolvePath(expr.segments);
      case 'function':
        return this.evalFunction(expr.name, expr.args);
      case 'filter':
        return this.evalFilterExpression(expr);
      case 'concat':
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        return expr.parts.map(p => String(this.evalExpression(p) ?? '')).join('');
      case 'unary':
        return this.evalUnary(expr.operator, expr.operand);
      case 'binary':
        return this.evalBinary(expr.operator, expr.left, expr.right);
      case 'default': {
        const val = this.evalExpression(expr.value);
        if (val === undefined || val === null) {
          return this.evalExpression(expr.defaultExpr);
        }
        return val;
      }
    }
  }

  private resolvePath(segments: readonly string[]): unknown {
    const len = segments.length;
    if (len === 0) {
      return undefined;
    }

    // Fast path: single segment (most common — `{{ name }}`, `{{ age }}`).
    if (len === 1) {
      return this.variables[segments[0]];
    }

    let current: unknown = this.variables[segments[0]];
    for (let i = 1; i < len; i++) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[segments[i]];
    }
    return current;
  }

  private evalRange(expr: { start: Expression; end: Expression }): number[] {
    const start = Number(this.evalExpression(expr.start));
    const end = Number(this.evalExpression(expr.end));
    const result: number[] = [];
    if (start <= end) {
      const len = end - start + 1;
      for (let i = 0; i < len; i++) {
        result[i] = start + i;
      }
    } else {
      const len = start - end + 1;
      for (let i = 0; i < len; i++) {
        result[i] = start - i;
      }
    }
    return result;
  }

  private evalFunction(name: string, args: readonly Expression[]): unknown {
    const resolvedArgs = args.map(a => this.evalExpression(a));

    if (name === 'cycle') {
      const values = resolvedArgs[0];
      const index = resolvedArgs[1];
      if (Array.isArray(values) && typeof index === 'number') {
        return values[index % values.length];
      }
      return '';
    }

    if (name === 'max') {
      if (resolvedArgs.length === 0) {
        return undefined;
      }
      if (resolvedArgs.length === 1 && Array.isArray(resolvedArgs[0])) {
        return Math.max(...(resolvedArgs[0] as number[]));
      }
      return Math.max(...(resolvedArgs as number[]));
    }

    if (name === 'min') {
      if (resolvedArgs.length === 0) {
        return undefined;
      }
      if (resolvedArgs.length === 1 && Array.isArray(resolvedArgs[0])) {
        return Math.min(...(resolvedArgs[0] as number[]));
      }
      return Math.min(...(resolvedArgs as number[]));
    }

    if (name === 'range') {
      if (resolvedArgs.length === 1) {
        const end = Number(resolvedArgs[0]);
        const result: number[] = [];
        const len = end + 1;
        for (let i = 0; i < len; i++) {
          result[i] = i;
        }
        return result;
      }
      if (resolvedArgs.length >= 2) {
        const start = Number(resolvedArgs[0]);
        const end = Number(resolvedArgs[1]);
        const step = resolvedArgs.length > 2 ? Number(resolvedArgs[2]) : start <= end ? 1 : -1;
        const result: number[] = [];
        if (step > 0) {
          const len = Math.floor((end - start) / step) + 1;
          for (let i = 0; i < len; i++) {
            result[i] = start + i * step;
          }
        } else if (step < 0) {
          const len = Math.floor((start - end) / -step) + 1;
          for (let i = 0; i < len; i++) {
            result[i] = start + i * step;
          }
        }
        return result;
      }
      return [];
    }

    // Unknown function — return empty string.
    return '';
  }

  private evalFilterExpression(expr: {
    subject: Expression;
    filters: readonly { name: string; arg: string | null }[];
  }): unknown {
    let value = this.evalExpression(expr.subject);
    for (const filterCall of expr.filters) {
      const fn = filters[filterCall.name];
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (fn !== undefined) {
        value = fn(value, filterCall.arg ?? undefined, this.variables);
      }
    }
    return value;
  }

  private evalUnary(operator: string, operand: Expression): unknown {
    const value = this.evalExpression(operand);
    if (operator === 'not') {
      return !isTruthy(value);
    }
    return value;
  }

  private evalBinary(operator: string, leftExpr: Expression, rightExpr: Expression): unknown {
    // Short-circuit for logical operators.
    if (operator === 'or') {
      const left = this.evalExpression(leftExpr);
      if (isTruthy(left)) {
        return true;
      }
      return isTruthy(this.evalExpression(rightExpr));
    }

    if (operator === 'and') {
      const left = this.evalExpression(leftExpr);
      if (!isTruthy(left)) {
        return false;
      }
      return isTruthy(this.evalExpression(rightExpr));
    }

    const left = this.evalExpression(leftExpr);
    const right = this.evalExpression(rightExpr);

    switch (operator) {
      case '==':
        return left === right || String(left) === String(right);
      case '!=':
        return left !== right && String(left) !== String(right);
      case '>':
        return Number(left) > Number(right);
      case '<':
        return Number(left) < Number(right);
      case '>=':
        return Number(left) >= Number(right);
      case '<=':
        return Number(left) <= Number(right);
      case 'in':
        return valueIn(left, right);
      case 'not in':
        return !valueIn(left, right);
      case 'is':
        return left === right;
      case 'is not':
        return left !== right;
      default:
        return false;
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const isTruthy = (value: unknown): boolean => {
  if (value === null || value === undefined || value === false || value === '' || value === 0) {
    return false;
  }
  if (Array.isArray(value) && value.length === 0) {
    return false;
  }
  return true;
};

const valueIn = (needle: unknown, haystack: unknown): boolean => {
  if (typeof haystack === 'string') {
    return haystack.includes(String(needle));
  }
  if (Array.isArray(haystack)) {
    return haystack.includes(needle);
  }
  if (haystack !== null && typeof haystack === 'object') {
    return Object.keys(haystack).includes(String(needle));
  }
  return false;
};
