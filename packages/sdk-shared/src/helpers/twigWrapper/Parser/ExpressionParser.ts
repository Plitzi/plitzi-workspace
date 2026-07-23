import { Char, isDigit } from '../charClass';
import { Cursor } from './Cursor';

import type { Expression, FilterCall } from '../AST';

// ── Expression Parser ────────────────────────────────────────────────────────
// Recursive-descent parser turning an expression string (a variable tag or a tag argument) into an
// Expression AST. Character-level scanning lives in the Cursor base class; this file is pure grammar.
// Precedence, loosest first:
//   ternary (? :) → or → and → not → comparisons (==,!=,>=,<=,>,<,in,not in,is,is not)
//   → ~ (concat) → +,- → *,/,% → ?? (default) → atoms (literals, paths, calls, filters, parens)

export const parseExpression = (expr: string): Expression => new ExpressionParser(expr).parseTernary();

// Parses a bare `{% apply %}` filter chain such as `upper | trim | capitalize` (no leading pipe, no subject).
export const parseApplyFilters = (expr: string): FilterCall[] => new ExpressionParser(expr).parseApplyChain();

class ExpressionParser extends Cursor {
  parseTernary(): Expression {
    const condition = this.parseOr();
    this.skipWs();
    if (this.peek() === Char.Question) {
      this.pos++;
      this.skipWs();
      const trueExpr = this.parseOr();
      this.skipWs();
      if (this.peek() === Char.Colon) {
        this.pos++;
        this.skipWs();
        const falseExpr = this.parseTernary();
        return { type: 'ternary', condition, trueExpr, falseExpr };
      }
    }

    return condition;
  }

  private parseOr(): Expression {
    let left = this.parseAnd();
    this.skipWs();
    while (this.matchKeyword('or')) {
      left = { type: 'binary', operator: 'or', left, right: this.parseAnd() };
      this.skipWs();
    }

    return left;
  }

  private parseAnd(): Expression {
    let left = this.parseNot();
    this.skipWs();
    while (this.matchKeyword('and')) {
      left = { type: 'binary', operator: 'and', left, right: this.parseNot() };
      this.skipWs();
    }

    return left;
  }

  private parseNot(): Expression {
    this.skipWs();
    if (this.matchKeyword('not')) {
      return { type: 'unary', operator: 'not', operand: this.parseComparison() };
    }

    return this.parseComparison();
  }

  private parseComparison(): Expression {
    let left = this.parseConcat();
    this.skipWs();

    while (!this.eof()) {
      if (this.matchKeyword('is')) {
        this.skipWs();
        const operator = this.matchKeyword('not') ? 'is not' : 'is';
        left = { type: 'binary', operator, left, right: this.parseConcat() };
        this.skipWs();
        continue;
      }

      if (this.matchKeyword('not')) {
        this.skipWs();
        if (this.matchKeyword('in')) {
          left = { type: 'binary', operator: 'not in', left, right: this.parseConcat() };
          this.skipWs();
          continue;
        }

        // A `not` that isn't `not in` is a unary operator over the rest of the expression.
        const rest = this.src.slice(this.pos - 4);
        this.pos = this.src.length;
        return { type: 'unary', operator: 'not', operand: parseExpression(rest) };
      }

      if (this.matchKeyword('in')) {
        left = { type: 'binary', operator: 'in', left, right: this.parseConcat() };
        this.skipWs();
        continue;
      }

      const op = this.matchBinaryOp();
      if (op) {
        left = { type: 'binary', operator: op, left, right: this.parseConcat() };
        this.skipWs();
        continue;
      }

      break;
    }

    return left;
  }

  private parseConcat(): Expression {
    let left = this.parseAdditive();
    this.skipWs();
    while (this.peek() === Char.Tilde) {
      this.pos++;
      const right = this.parseAdditive();
      left =
        left.type === 'concat'
          ? { type: 'concat', parts: [...left.parts, right] }
          : { type: 'concat', parts: [left, right] };
      this.skipWs();
    }

    return left;
  }

  private parseAdditive(): Expression {
    let left = this.parseMultiplicative();
    this.skipWs();
    for (let ch = this.peek(); ch === Char.Plus || ch === Char.Minus; ch = this.peek()) {
      this.pos++;
      left = { type: 'binary', operator: ch === Char.Plus ? '+' : '-', left, right: this.parseMultiplicative() };
      this.skipWs();
    }

    return left;
  }

  private parseMultiplicative(): Expression {
    let left = this.parseDefault();
    this.skipWs();
    for (let ch = this.peek(); ch === Char.Star || ch === Char.Slash || ch === Char.Percent; ch = this.peek()) {
      this.pos++;
      const operator = ch === Char.Star ? '*' : ch === Char.Slash ? '/' : '%';
      left = { type: 'binary', operator, left, right: this.parseDefault() };
      this.skipWs();
    }

    return left;
  }

  private parseDefault(): Expression {
    // Skip leading whitespace so a unary minus is still recognised when it follows an operator, e.g. the
    // right operand of `10 - -2` reaches here as ` -2`.
    this.skipWs();

    // Unary minus: `-expr` — must check before parseAtom to avoid consuming the `-` as part of a negative literal.
    if (this.peek() === Char.Minus && isDigit(this.at(1))) {
      // Negative number literal — let scanNumber handle it normally.
      return this.maybeTrailingFilters({ type: 'literal', value: this.scanNumber() });
    }

    if (this.peek() === Char.Minus) {
      this.pos++;
      return { type: 'unary', operator: '-', operand: this.parseDefault() };
    }

    let left = this.parseAtom();
    this.skipWs();
    while (this.peek() === Char.Question && this.at(1) === Char.Question) {
      this.pos += 2;
      this.skipWs();
      left = { type: 'default', value: left, defaultExpr: this.parseAtom() };
      this.skipWs();
    }

    return left;
  }

  private parseAtom(): Expression {
    this.skipWs();
    const ch = this.peek();

    if (ch === Char.LParen) {
      this.pos++;
      this.skipWs();

      // Check if this is an arrow function: (param1, param2) =>
      const savedPos = this.pos;
      const params = this.tryParseArrowParams();
      if (params !== null) {
        // It's an arrow function
        return this.maybeTrailingFilters({ type: 'arrow', params, body: this.parseTernary() });
      }

      // Not an arrow function, parse as grouped expression
      this.pos = savedPos;
      const expr = this.parseTernary();
      this.skipWs();
      if (this.peek() === Char.RParen) {
        this.pos++;
      }

      return this.maybeTrailingFilters(expr);
    }

    if (ch === Char.SingleQuote || ch === Char.DoubleQuote) {
      return this.maybeTrailingFilters({ type: 'literal', value: this.scanStringLiteral() });
    }

    if (isDigit(ch)) {
      return this.maybeTrailingFilters({ type: 'literal', value: this.scanNumber() });
    }

    if (ch === Char.LBracket) {
      this.pos++;
      return this.maybeTrailingFilters({ type: 'array', elements: this.parseArgList(Char.RBracket) });
    }

    if (ch === Char.LBrace) {
      this.pos++;
      return this.maybeTrailingFilters(this.parseObjectLiteral());
    }

    // Check for single-param arrow function: param =>
    return this.parsePathOrFunctionOrArrow();
  }

  // Tries to parse arrow function params inside parentheses.
  // Returns the param names if this is `(name1, name2) =>`, or null if not an arrow function.
  private tryParseArrowParams(): string[] | null {
    const params: string[] = [];
    const startPos = this.pos;

    // Try to read identifier list
    while (!this.eof()) {
      this.skipWs();
      const name = this.scanName();
      if (!name) {
        this.pos = startPos;
        return null;
      }
      params.push(name);
      this.skipWs();
      if (this.peek() === Char.Comma) {
        this.pos++;
        continue;
      }
      break;
    }

    this.skipWs();

    // Check for closing paren followed by =>
    if (this.peek() === Char.RParen) {
      this.pos++;
      this.skipWs();
      if (this.peek() === Char.Equals && this.at(1) === Char.Greater) {
        this.pos += 2;
        return params;
      }
    }

    this.pos = startPos;
    return null;
  }

  private parsePathOrFunctionOrArrow(): Expression {
    const name = this.scanName();
    if (!name) {
      this.pos++;
      return { type: 'literal', value: '' };
    }

    if (name === 'true' || name === 'false') {
      return this.maybeTrailingFilters({ type: 'literal', value: name === 'true' });
    }

    this.skipWs();

    // Check for single-param arrow function: name =>
    if (this.peek() === Char.Equals && this.at(1) === Char.Greater) {
      this.pos += 2;
      return this.maybeTrailingFilters({ type: 'arrow', params: [name], body: this.parseTernary() });
    }

    if (this.peek() === Char.LParen) {
      this.pos++;
      const args = this.parseArgList(Char.RParen);
      return this.maybeTrailingFilters({ type: 'function', name, args });
    }

    const segments: string[] = [name];
    while (this.peek() === Char.Dot) {
      this.pos++;
      const segment = this.scanName();
      if (segment) {
        segments.push(segment);
      }
    }

    return this.maybeTrailingFilters({ type: 'path', segments });
  }

  // Wraps a subject expression in a FilterExpression when a `| filter` chain follows it.
  private maybeTrailingFilters(subject: Expression): Expression {
    this.skipWs();
    if (this.peek() !== Char.Pipe) {
      return subject;
    }

    return { type: 'filter', subject, filters: this.parseTrailingFilters() };
  }

  // Parses an object literal `{ key: expr, "quoted": expr }` from a cursor sitting just past the `{`.
  // Keys are static — a bare identifier or a quoted string; the closing `}` is consumed.
  private parseObjectLiteral(): Expression {
    const entries: { key: string; value: Expression }[] = [];
    this.skipWs();
    while (!this.eof() && this.peek() !== Char.RBrace) {
      const quote = this.peek();
      const key = quote === Char.SingleQuote || quote === Char.DoubleQuote ? this.scanStringLiteral() : this.scanName();
      this.skipWs();
      if (this.peek() === Char.Colon) {
        this.pos++;
      }

      this.skipWs();
      entries.push({ key, value: this.parseTernary() });
      this.skipWs();
      if (this.peek() === Char.Comma) {
        this.pos++;
        this.skipWs();
      }
    }

    if (this.peek() === Char.RBrace) {
      this.pos++;
    }

    return { type: 'object', entries };
  }

  // Parses a comma-separated expression list up to (and consuming) the given closing char code (`)` or `]`).
  private parseArgList(closeChar: number): Expression[] {
    const args: Expression[] = [];
    this.skipWs();
    while (!this.eof() && this.peek() !== closeChar) {
      args.push(this.parseTernary());
      this.skipWs();
      if (this.peek() === Char.Comma) {
        this.pos++;
        this.skipWs();
      }
    }

    if (this.peek() === closeChar) {
      this.pos++;
    }

    return args;
  }

  // Reads a `| filter | filter(args)` chain from a cursor sitting on the first `|`.
  private parseTrailingFilters(): FilterCall[] {
    const filters: FilterCall[] = [];
    while (this.peek() === Char.Pipe) {
      this.pos++;
      this.skipWs();
      filters.push(this.readFilter());
      this.skipWs();
    }

    return filters;
  }

  // Reads an `{% apply %}` chain: a first filter with no leading pipe, then any number of `| filter`.
  parseApplyChain(): FilterCall[] {
    this.skipWs();
    const filters: FilterCall[] = [this.readFilter()];
    this.skipWs();
    while (this.peek() === Char.Pipe) {
      this.pos++;
      this.skipWs();
      filters.push(this.readFilter());
      this.skipWs();
    }

    return filters;
  }

  // Reads a single filter: a name followed by an optional parenthesised argument list.
  private readFilter(): FilterCall {
    const name = this.scanName();
    this.skipWs();
    if (this.peek() === Char.LParen) {
      this.pos++;
      return { name, args: this.parseArgList(Char.RParen) };
    }

    return { name, args: [] };
  }
}
