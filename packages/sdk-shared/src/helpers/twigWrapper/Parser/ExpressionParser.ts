import type { Expression, FilterCall } from '../AST';

// ── Expression Parser ────────────────────────────────────────────────────────
// Parses a single expression string (from a variable tag or tag argument) into
// an Expression AST node. Handles operator precedence:
//   1. or
//   2. and
//   3. not (unary)
//   4. comparisons (==, !=, >=, <=, >, <, in, not in, is, is not)
//   5. ~ (concatenation)
//   6. ?? (default)
//   7. atoms (literals, paths, function calls, filter chains, parenthesized)

export const parseExpression = (expr: string): Expression => {
  const parser = new ExpressionParser(expr);
  return parser.parseTernary();
};

class ExpressionParser {
  private readonly src: string;
  private pos = 0;

  constructor(src: string) {
    this.src = src;
  }

  private skipWs(): void {
    while (
      this.pos < this.src.length &&
      (this.src.charCodeAt(this.pos) === 32 || this.src.charCodeAt(this.pos) === 9)
    ) {
      this.pos++;
    }
  }

  private peekChar(): number {
    return this.pos < this.src.length ? this.src.charCodeAt(this.pos) : -1;
  }

  parseOr(): Expression {
    let left = this.parseAnd();
    this.skipWs();
    while (this.matchKeyword('or')) {
      const right = this.parseAnd();
      left = { type: 'binary', operator: 'or', left, right };
      this.skipWs();
    }
    return left;
  }

  parseTernary(): Expression {
    const condition = this.parseOr();
    this.skipWs();
    if (this.peekChar() === 63) {
      this.pos++;
      this.skipWs();
      const trueExpr = this.parseOr();
      this.skipWs();
      if (this.peekChar() === 58) {
        this.pos++;
        this.skipWs();
        const falseExpr = this.parseOr();
        return { type: 'ternary', condition, trueExpr, falseExpr };
      }
    }
    return condition;
  }

  parseAnd(): Expression {
    let left = this.parseNot();
    this.skipWs();
    while (this.matchKeyword('and')) {
      const right = this.parseNot();
      left = { type: 'binary', operator: 'and', left, right };
      this.skipWs();
    }
    return left;
  }

  parseNot(): Expression {
    this.skipWs();
    if (this.matchKeyword('not')) {
      const operand = this.parseComparison();
      return { type: 'unary', operator: 'not', operand };
    }
    return this.parseComparison();
  }

  parseComparison(): Expression {
    let left = this.parseConcat();
    this.skipWs();

    while (this.pos < this.src.length) {
      if (this.matchKeyword('is')) {
        this.skipWs();
        if (this.matchKeyword('not')) {
          const right = this.parseConcat();
          left = { type: 'binary', operator: 'is not', left, right };
          this.skipWs();
          continue;
        }
        const right = this.parseConcat();
        left = { type: 'binary', operator: 'is', left, right };
        this.skipWs();
        continue;
      }

      if (this.matchKeyword('not')) {
        this.skipWs();
        if (this.matchKeyword('in')) {
          const right = this.parseConcat();
          left = { type: 'binary', operator: 'not in', left, right };
          this.skipWs();
          continue;
        }
        const rest = this.src.slice(this.pos - 4);
        this.pos = this.src.length;
        return { type: 'unary', operator: 'not', operand: parseExpression(rest) };
      }

      const op = this.matchBinaryOp();
      if (op) {
        const right = this.parseConcat();
        left = { type: 'binary', operator: op, left, right };
        this.skipWs();
        continue;
      }

      break;
    }

    return left;
  }

  parseConcat(): Expression {
    let left = this.parseAdditive();
    this.skipWs();
    while (this.pos < this.src.length && this.src.charCodeAt(this.pos) === 126) {
      this.pos++;
      const right = this.parseAdditive();
      if (left.type === 'concat') {
        left = { type: 'concat', parts: [...left.parts, right] };
      } else {
        left = { type: 'concat', parts: [left, right] };
      }
      this.skipWs();
    }
    return left;
  }

  parseAdditive(): Expression {
    let left = this.parseMultiplicative();
    this.skipWs();
    while (this.pos < this.src.length) {
      const ch = this.peekChar();
      if (ch === 43 || ch === 45) {
        const op = ch === 43 ? '+' : '-';
        this.pos++;
        const right = this.parseMultiplicative();
        left = { type: 'binary', operator: op, left, right };
        this.skipWs();
        continue;
      }
      break;
    }
    return left;
  }

  parseMultiplicative(): Expression {
    let left = this.parseDefault();
    this.skipWs();
    while (this.pos < this.src.length) {
      const ch = this.peekChar();
      if (ch === 42 || ch === 47 || ch === 37) {
        const op = ch === 42 ? '*' : ch === 47 ? '/' : '%';
        this.pos++;
        const right = this.parseDefault();
        left = { type: 'binary', operator: op, left, right };
        this.skipWs();
        continue;
      }
      break;
    }
    return left;
  }

  parseDefault(): Expression {
    let left = this.parseAtom();
    this.skipWs();
    while (this.peekChar() === 63 && this.src.charCodeAt(this.pos + 1) === 63) {
      this.pos += 2;
      this.skipWs();
      const defaultExpr = this.parseAtom();
      left = { type: 'default', value: left, defaultExpr };
      this.skipWs();
    }
    return left;
  }

  parseAtom(): Expression {
    this.skipWs();
    const ch = this.peekChar();

    if (ch === 40) {
      this.pos++;
      const expr = this.parseTernary();
      this.skipWs();
      if (this.peekChar() === 41) {
        this.pos++;
      }
      return expr;
    }

    if (ch === 39 || ch === 34) {
      return this.parseStringLiteral();
    }

    if (ch === 45 || (ch >= 48 && ch <= 57)) {
      return this.parseNumberLiteral();
    }

    if (ch === 91) {
      return this.parseArrayLiteral();
    }

    return this.parsePathOrFunction();
  }

  private parseStringLiteral(): { type: 'literal'; value: string } {
    const quote = this.src[this.pos];
    const start = this.pos + 1;
    this.pos = start;
    while (this.pos < this.src.length && this.src[this.pos] !== quote) {
      this.pos++;
    }
    const value = this.src.slice(start, this.pos);
    if (this.pos < this.src.length) {
      this.pos++;
    }
    return { type: 'literal', value };
  }

  private parseNumberLiteral(): { type: 'literal'; value: number } {
    const start = this.pos;
    if (this.src.charCodeAt(this.pos) === 45) {
      this.pos++;
    }
    while (this.pos < this.src.length && this.src.charCodeAt(this.pos) >= 48 && this.src.charCodeAt(this.pos) <= 57) {
      this.pos++;
    }
    if (this.pos < this.src.length && this.src.charCodeAt(this.pos) === 46) {
      this.pos++;
      while (this.pos < this.src.length && this.src.charCodeAt(this.pos) >= 48 && this.src.charCodeAt(this.pos) <= 57) {
        this.pos++;
      }
    }
    return { type: 'literal', value: Number(this.src.slice(start, this.pos)) };
  }

  private parseArrayLiteral(): Expression {
    this.pos++;
    const elements: Expression[] = [];
    this.skipWs();
    while (this.pos < this.src.length && this.peekChar() !== 93) {
      elements.push(this.parseOr());
      this.skipWs();
      if (this.peekChar() === 44) {
        this.pos++;
        this.skipWs();
      }
    }
    if (this.peekChar() === 93) {
      this.pos++;
    }
    return { type: 'array', elements };
  }

  private parsePathOrFunction(): Expression {
    const start = this.pos;
    while (
      this.pos < this.src.length &&
      ((this.src.charCodeAt(this.pos) >= 97 && this.src.charCodeAt(this.pos) <= 122) ||
        (this.src.charCodeAt(this.pos) >= 65 && this.src.charCodeAt(this.pos) <= 90) ||
        (this.src.charCodeAt(this.pos) >= 48 && this.src.charCodeAt(this.pos) <= 57) ||
        this.src.charCodeAt(this.pos) === 95 ||
        this.src.charCodeAt(this.pos) === 45)
    ) {
      this.pos++;
    }

    const name = this.src.slice(start, this.pos);
    if (!name) {
      this.pos++;
      return { type: 'literal', value: '' };
    }

    if (name === 'true') {
      return { type: 'literal', value: true };
    }
    if (name === 'false') {
      return { type: 'literal', value: false };
    }

    this.skipWs();
    if (this.peekChar() === 40) {
      this.pos++;
      const args: Expression[] = [];
      this.skipWs();
      while (this.pos < this.src.length && this.peekChar() !== 41) {
        args.push(this.parseOr());
        this.skipWs();
        if (this.peekChar() === 44) {
          this.pos++;
          this.skipWs();
        }
      }
      if (this.peekChar() === 41) {
        this.pos++;
      }
      this.skipWs();
      if (this.peekChar() === 124) {
        const filters = this.parseFilterChainFromPos();
        return { type: 'filter', subject: { type: 'function', name, args }, filters };
      }
      return { type: 'function', name, args };
    }

    const segments: string[] = [name];
    while (this.peekChar() === 46) {
      this.pos++;
      const segStart = this.pos;
      while (
        this.pos < this.src.length &&
        ((this.src.charCodeAt(this.pos) >= 97 && this.src.charCodeAt(this.pos) <= 122) ||
          (this.src.charCodeAt(this.pos) >= 65 && this.src.charCodeAt(this.pos) <= 90) ||
          (this.src.charCodeAt(this.pos) >= 48 && this.src.charCodeAt(this.pos) <= 57) ||
          this.src.charCodeAt(this.pos) === 95 ||
          this.src.charCodeAt(this.pos) === 45)
      ) {
        this.pos++;
      }
      if (this.pos > segStart) {
        segments.push(this.src.slice(segStart, this.pos));
      }
    }

    this.skipWs();
    if (this.peekChar() === 124) {
      const filters = this.parseFilterChainFromPos();
      return { type: 'filter', subject: { type: 'path', segments }, filters };
    }

    return { type: 'path', segments };
  }

  private parseFilterChainFromPos(): readonly FilterCall[] {
    const filters: FilterCall[] = [];
    while (this.peekChar() === 124) {
      this.pos++;
      this.skipWs();
      const filterStart = this.pos;
      while (
        this.pos < this.src.length &&
        ((this.src.charCodeAt(this.pos) >= 97 && this.src.charCodeAt(this.pos) <= 122) ||
          (this.src.charCodeAt(this.pos) >= 65 && this.src.charCodeAt(this.pos) <= 90) ||
          (this.src.charCodeAt(this.pos) >= 48 && this.src.charCodeAt(this.pos) <= 57) ||
          this.src.charCodeAt(this.pos) === 95)
      ) {
        this.pos++;
      }
      const filterName = this.src.slice(filterStart, this.pos);
      this.skipWs();
      let filterArg: string | null = null;
      if (this.peekChar() === 40) {
        let parenDepth = 1;
        this.pos++;
        const argStart = this.pos;
        while (this.pos < this.src.length && parenDepth > 0) {
          if (this.src.charCodeAt(this.pos) === 40) {
            parenDepth++;
          } else if (this.src.charCodeAt(this.pos) === 41) {
            break;
          }
          this.pos++;
        }
        filterArg = this.src.slice(argStart, this.pos);
        if (this.peekChar() === 41) {
          this.pos++;
        }
      }
      if (filterName) {
        filters.push({ name: filterName, arg: filterArg || null });
      }
      this.skipWs();
    }
    return filters;
  }

  private matchKeyword(kw: string): boolean {
    const end = this.pos + kw.length;
    if (end > this.src.length) {
      return false;
    }
    for (let i = 0; i < kw.length; i++) {
      if (this.src.charCodeAt(this.pos + i) !== kw.charCodeAt(i)) {
        return false;
      }
    }
    if (end < this.src.length) {
      const next = this.src.charCodeAt(end);
      if ((next >= 97 && next <= 122) || (next >= 65 && next <= 90) || (next >= 48 && next <= 57) || next === 95) {
        return false;
      }
    }
    this.pos = end;
    this.skipWs();
    return true;
  }

  private matchBinaryOp(): string | null {
    this.skipWs();
    const ch = this.peekChar();

    if (this.pos + 1 < this.src.length) {
      const two = this.src.slice(this.pos, this.pos + 2);
      if (two === '==') {
        this.pos += 2;
        return '==';
      }
      if (two === '!=') {
        this.pos += 2;
        return '!=';
      }
      if (two === '>=') {
        this.pos += 2;
        return '>=';
      }
      if (two === '<=') {
        this.pos += 2;
        return '<=';
      }
    }

    if (ch === 62) {
      this.pos++;
      return '>';
    }
    if (ch === 60) {
      this.pos++;
      return '<';
    }

    return null;
  }
}

// Parse a filter chain string like `| upper | truncate(10)` into FilterCall[].
export const parseFilterChain = (filtersStr: string): FilterCall[] => {
  const filters: FilterCall[] = [];
  const matches = filtersStr.matchAll(/\|\s*([a-zA-Z0-9_]+)(?:\(([^)]*)\))?/g);
  for (const match of matches) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    filters.push({ name: match[1], arg: match[2] ?? null });
  }
  return filters;
};
