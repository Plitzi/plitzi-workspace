import { isTruthy, valueIn, resolveCollection, resolveObjectEntries } from './helpers';
import { filters, isRawMarker, unwrapRaw } from '../filters/filters';

import type { ASTNode, Expression, FilterCall, IfNode, ForNode, SetNode, ApplyNode, VariableNode } from '../AST';

export type EvalResult = {
  readonly output: string;
  readonly variables: Record<string, unknown>;
  readonly hasSet: boolean;
};

// Shared empty argument list for no-arg filters (`| upper`, `| trim`, …) — avoids a per-call allocation.
const NO_ARGS: readonly unknown[] = [];

export const evaluate = (
  nodes: readonly ASTNode[],
  context: Record<string, unknown>,
  keepEmptyTokens = false
): EvalResult => {
  const ctx = new Evaluator(context, keepEmptyTokens);
  const output = ctx.evalNodes(nodes);
  return { output, variables: ctx.variables, hasSet: ctx.hasSet };
};

// Loop metadata exposed as `{{ loop.* }}`. Each `{% for %}` gets its own instance, so a nested loop never
// corrupts the enclosing loop's counters.
type LoopState = {
  index: number;
  index0: number;
  first: boolean;
  last: boolean;
  length: number;
  revindex: number;
};

class Evaluator {
  readonly variables: Record<string, unknown>;
  private readonly keepEmptyTokens: boolean;
  private breakFlag = false;
  private continueFlag = false;
  hasSet = false;

  constructor(context: Record<string, unknown>, keepEmptyTokens = false) {
    // Shallow own-property copy for scratch (loop/`set` vars). A plain object keeps every variable read as a
    // fast monomorphic own-property access — measurably faster than an `Object.create(context)` prototype
    // chain for the common small-context template, which more than pays for the one-time copy.
    this.variables = { ...context };
    this.keepEmptyTokens = keepEmptyTokens;
  }

  evalNodes(nodes: readonly ASTNode[]): string {
    const len = nodes.length;
    if (len === 0) {
      return '';
    }
    if (len === 1) {
      return this.evalNode(nodes[0]);
    }

    // Build into an array only for larger bodies; small ones concatenate directly to skip the allocation.
    let output = '';
    for (let i = 0; i < len; i++) {
      output += this.evalNode(nodes[i]);
      if (this.breakFlag || this.continueFlag) {
        break;
      }
    }

    return output;
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

    if (this.keepEmptyTokens && (value === undefined || value === null || value === '')) {
      return node.source;
    }

    if (isRawMarker(value)) {
      return String(unwrapRaw(value));
    }

    // Primitives: fast path (most common).
    if (value !== null && value !== undefined && typeof value !== 'object') {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      return String(value);
    }

    if (node.raw) {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      return value === null || value === undefined ? '' : String(value);
    }

    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }

    return '';
  }

  private evalIf(node: IfNode): string {
    if (isTruthy(this.evalExpression(node.condition))) {
      return this.evalNodes(node.body);
    }

    for (const elif of node.elseifClauses) {
      if (isTruthy(this.evalExpression(elif.condition))) {
        return this.evalNodes(elif.body);
      }
    }

    return node.elseBody ? this.evalNodes(node.elseBody) : '';
  }

  private evalFor(node: ForNode): string {
    const collection = this.evalExpression(node.collection);

    // Known limitation: in keepEmptyTokens mode a missing/empty collection renders '' (or the else body) rather
    // than preserving the `{% for %}…{% endfor %}` verbatim — a ForNode carries no source text to re-emit, so
    // unresolved loop bindings are not kept the way unresolved `{{ token }}`s are. See the complex test suite.

    // Normalise both iteration shapes to parallel arrays: `values` always, `keys` only for `for k, v in obj`.
    let values: unknown[];
    let keys: unknown[] | null = null;
    if (node.keyVar !== null) {
      const entries = resolveObjectEntries(collection);
      if (!entries || entries.length === 0) {
        return node.elseBody ? this.evalNodes(node.elseBody) : '';
      }

      const length = entries.length;
      keys = new Array<unknown>(length);
      values = new Array<unknown>(length);
      for (let i = 0; i < length; i++) {
        keys[i] = entries[i][0];
        values[i] = entries[i][1];
      }
    } else {
      const items = resolveCollection(collection);
      if (!items || items.length === 0) {
        return node.elseBody ? this.evalNodes(node.elseBody) : '';
      }
      values = items;
    }

    return this.runLoop(node, values, keys);
  }

  // Runs a loop body once per element, exposing `{{ loop.* }}` and honouring {% break %} / {% continue %}. Each
  // loop owns its `loop` state, so a nested loop never corrupts the enclosing loop's counters.
  private runLoop(node: ForNode, values: readonly unknown[], keys: readonly unknown[] | null): string {
    const { valueVar, keyVar, body } = node;
    const length = values.length;
    const parentLoop = this.variables['loop'];
    const loop: LoopState = { index: 0, index0: 0, first: false, last: false, length, revindex: 0 };
    this.variables['loop'] = loop;

    let output = '';
    for (let i = 0; i < length; i++) {
      loop.index = i + 1;
      loop.index0 = i;
      loop.first = i === 0;
      loop.last = i === length - 1;
      loop.revindex = length - i;
      if (keys !== null && keyVar !== null) {
        this.variables[keyVar] = keys[i];
      }
      this.variables[valueVar] = values[i];

      output += this.evalNodes(body);
      if (this.breakFlag) {
        this.breakFlag = false;
        break;
      }
      if (this.continueFlag) {
        this.continueFlag = false;
      }
    }

    if (parentLoop !== undefined) {
      this.variables['loop'] = parentLoop;
    } else {
      delete this.variables['loop'];
    }

    return output;
  }

  private evalSet(node: SetNode): string {
    this.hasSet = true;
    this.variables[node.name] = Array.isArray(node.value)
      ? this.evalNodes(node.value)
      : this.evalExpression(node.value);

    return '';
  }

  private evalApply(node: ApplyNode): string {
    const value = this.applyFilters(this.evalNodes(node.body), node.filters);

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

  private applyFilters(initial: unknown, calls: readonly FilterCall[]): unknown {
    let value = initial;
    for (const call of calls) {
      const fn = filters[call.name];
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (fn !== undefined) {
        value = fn(value, call.args.length === 0 ? NO_ARGS : this.evalArgs(call.args));
      }
    }

    return value;
  }

  private evalArgs(exprs: readonly Expression[]): unknown[] {
    const len = exprs.length;
    const args = new Array<unknown>(len);
    for (let i = 0; i < len; i++) {
      args[i] = this.evalExpression(exprs[i]);
    }

    return args;
  }

  evalExpression(expr: Expression): unknown {
    switch (expr.type) {
      case 'literal':
        return expr.value;
      case 'array': {
        const elems = expr.elements;
        const arr = new Array<unknown>(elems.length);
        for (let i = 0; i < elems.length; i++) {
          arr[i] = this.evalExpression(elems[i]);
        }

        return arr;
      }
      case 'range':
        return this.evalRange(expr.start, expr.end);
      case 'path':
        return this.resolvePath(expr.segments);
      case 'function':
        return this.evalFunction(expr.name, expr.args);
      case 'filter':
        return this.applyFilters(this.evalExpression(expr.subject), expr.filters);
      case 'concat': {
        const parts = expr.parts;
        const len = parts.length;
        let out = '';
        for (let i = 0; i < len; i++) {
          const v = this.evalExpression(parts[i]);
          // eslint-disable-next-line @typescript-eslint/no-base-to-string
          out += v === null || v === undefined ? '' : String(v);
        }

        return out;
      }
      case 'unary':
        return !isTruthy(this.evalExpression(expr.operand));
      case 'binary':
        return this.evalBinary(expr.operator, expr.left, expr.right);
      case 'default': {
        const val = this.evalExpression(expr.value);
        return val === undefined || val === null ? this.evalExpression(expr.defaultExpr) : val;
      }
      case 'ternary':
        return isTruthy(this.evalExpression(expr.condition))
          ? this.evalExpression(expr.trueExpr)
          : this.evalExpression(expr.falseExpr);
    }
  }

  private resolvePath(segments: readonly string[]): unknown {
    const len = segments.length;
    if (len === 0) {
      return undefined;
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

  private evalRange(startExpr: Expression, endExpr: Expression): number[] {
    const start = Number(this.evalExpression(startExpr));
    const end = Number(this.evalExpression(endExpr));
    const ascending = start <= end;
    const len = (ascending ? end - start : start - end) + 1;
    const result = new Array<number>(len);
    for (let i = 0; i < len; i++) {
      result[i] = ascending ? start + i : start - i;
    }

    return result;
  }

  private evalFunction(name: string, args: readonly Expression[]): unknown {
    const resolved = this.evalArgs(args);

    switch (name) {
      case 'cycle': {
        const values = resolved[0];
        const index = resolved[1];
        if (Array.isArray(values) && typeof index === 'number') {
          return values[index % values.length];
        }

        return '';
      }
      case 'max':
        return this.minMax(resolved, Math.max);
      case 'min':
        return this.minMax(resolved, Math.min);
      case 'range':
        return this.rangeFunction(resolved);
      default:
        return '';
    }
  }

  private minMax(args: readonly unknown[], pick: (...n: number[]) => number): number | undefined {
    if (args.length === 0) {
      return undefined;
    }

    const nums = args.length === 1 && Array.isArray(args[0]) ? (args[0] as number[]) : (args as number[]);
    return pick(...nums);
  }

  private rangeFunction(args: readonly unknown[]): number[] {
    if (args.length === 0) {
      return [];
    }

    if (args.length === 1) {
      const end = Number(args[0]);
      const result = new Array<number>(end + 1);
      for (let i = 0; i <= end; i++) {
        result[i] = i;
      }

      return result;
    }

    const start = Number(args[0]);
    const end = Number(args[1]);
    const step = args.length > 2 ? Number(args[2]) : start <= end ? 1 : -1;
    if (step === 0) {
      return [];
    }

    const len = Math.floor((step > 0 ? end - start : start - end) / Math.abs(step)) + 1;
    if (len <= 0) {
      return [];
    }

    const result = new Array<number>(len);
    for (let i = 0; i < len; i++) {
      result[i] = start + i * step;
    }

    return result;
  }

  private evalBinary(operator: string, leftExpr: Expression, rightExpr: Expression): unknown {
    if (operator === 'or') {
      return isTruthy(this.evalExpression(leftExpr)) || isTruthy(this.evalExpression(rightExpr));
    }
    if (operator === 'and') {
      return isTruthy(this.evalExpression(leftExpr)) && isTruthy(this.evalExpression(rightExpr));
    }

    const left = this.evalExpression(leftExpr);
    const right = this.evalExpression(rightExpr);

    // Fast path: when both operands are already numbers, skip Number() conversion.
    const bothNum = typeof left === 'number' && typeof right === 'number';

    switch (operator) {
      case '+':
        return bothNum ? left + right : Number(left) + Number(right);
      case '-':
        return bothNum ? left - right : Number(left) - Number(right);
      case '*':
        return bothNum ? left * right : Number(left) * Number(right);
      case '/':
        return bothNum ? left / right : Number(left) / Number(right);
      case '%':
        return bothNum ? left % right : Number(left) % Number(right);
      case '==':
        return left === right || String(left) === String(right);
      case '!=':
        return left !== right && String(left) !== String(right);
      case '>':
        return bothNum ? left > right : Number(left) > Number(right);
      case '<':
        return bothNum ? left < right : Number(left) < Number(right);
      case '>=':
        return bothNum ? left >= right : Number(left) >= Number(right);
      case '<=':
        return bothNum ? left <= right : Number(left) <= Number(right);
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
