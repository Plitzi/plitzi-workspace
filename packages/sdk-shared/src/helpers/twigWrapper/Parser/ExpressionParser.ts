import { Char, isDigit } from '../charClass';
import { Cursor } from './Cursor';

import type { Expression, FilterCall } from '../AST';

// ── Expression Parser ────────────────────────────────────────────────────────
// Recursive-descent parser turning an expression string (a variable tag or a tag argument) into an
// Expression AST. Character-level scanning lives in the Cursor base class; this file is pure grammar.
// Precedence, loosest first:
//   ternary (? :, ?:) → or → and → not → comparisons (==,!=,>=,<=,>,<,in,not in,is,is not,starts with,ends with)
//   → ~ (concat) → +,- → *,/,//,% → ** → ?? (default) → atoms (literals, paths, calls, filters, parens)
//
// The parse is forgiving at run time — a template it cannot read renders what it can — and that is exactly what
// makes a mistake silent. So every place it forgives something can also say so: handed an `issues` list, the parser
// writes down what it skipped, and `inspectTemplate` turns that into the refusal an author sees.

export const parseExpression = (expr: string, issues?: string[]): Expression => {
  const parser = new ExpressionParser(expr, issues);
  const expression = parser.parseTernary();
  parser.expectEnd();

  return expression;
};

// Parses a bare `{% apply %}` filter chain such as `upper | trim | capitalize` (no leading pipe, no subject).
export const parseApplyFilters = (expr: string, issues?: string[]): FilterCall[] => {
  const parser = new ExpressionParser(expr, issues);
  const filters = parser.parseApplyChain();
  parser.expectEnd();

  return filters;
};

/**
 * Twig's regular-expression test, refused rather than implemented.
 *
 * Templates are evaluated on the shared page server, and a pattern that backtracks catastrophically would stall it for
 * every space it serves — so the language keeps the tests that cannot: `starts with`, `ends with` and `in`.
 */
/** Twig's tests that take an argument: two words, then the argument in parentheses. */
const WORDED_TESTS = ['same as', 'divisible by'] as const;

const MATCHES_UNSUPPORTED =
  '`matches` is not supported: templates evaluate no regular expressions. Use `starts with`, `ends with` or `in`.';

class ExpressionParser extends Cursor {
  private readonly issues: string[] | undefined;

  constructor(src: string, issues?: string[]) {
    super(src);
    this.issues = issues;
  }

  private report(issue: string): void {
    this.issues?.push(issue);
  }

  /** Whatever is left once the grammar is done is something it could not read, and was about to drop. */
  expectEnd(): void {
    this.skipWs();
    if (!this.eof()) {
      this.report(`Unexpected "${this.src.slice(this.pos).trim()}" in "${this.src.trim()}"`);
    }
  }

  private expectChar(char: number, what: string): void {
    this.skipWs();
    if (this.peek() === char) {
      this.pos++;

      return;
    }

    this.report(`Missing ${what} in "${this.src.trim()}"`);
  }

  parseTernary(): Expression {
    const condition = this.parseOr();
    this.skipWs();
    if (this.peek() !== Char.Question) {
      return condition;
    }

    this.pos++;
    this.skipWs();
    // `a ?: b` — the value itself when it is truthy, the fallback otherwise.
    if (this.peek() === Char.Colon) {
      this.pos++;
      this.skipWs();

      return { type: 'ternary', condition, trueExpr: null, falseExpr: this.parseTernary() };
    }

    const trueExpr = this.parseOr();
    this.skipWs();
    if (this.peek() !== Char.Colon) {
      // `a ? b` — Twig's short form, empty when the condition is false.
      return { type: 'ternary', condition, trueExpr, falseExpr: { type: 'literal', value: '' } };
    }

    this.pos++;
    this.skipWs();

    return { type: 'ternary', condition, trueExpr, falseExpr: this.parseTernary() };
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
        const negated = this.matchKeyword('not');
        this.skipWs();
        const worded = this.matchWordedTest();
        if (worded) {
          // `x is same as(y)`: a test with an argument, its own operator — never `same` compared with `x`.
          const test: Expression = { type: 'binary', operator: worded, left, right: this.parseConcat() };
          left = negated ? { type: 'unary', operator: 'not', operand: test } : test;
          this.skipWs();
          continue;
        }

        left = { type: 'binary', operator: negated ? 'is not' : 'is', left, right: this.parseConcat() };
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
        return { type: 'unary', operator: 'not', operand: parseExpression(rest, this.issues) };
      }

      if (this.matchKeyword('in')) {
        left = { type: 'binary', operator: 'in', left, right: this.parseConcat() };
        this.skipWs();
        continue;
      }

      const affix = this.matchAffixTest();
      if (affix) {
        left = { type: 'binary', operator: affix, left, right: this.parseConcat() };
        this.skipWs();
        continue;
      }

      if (this.matchKeyword('matches')) {
        this.report(MATCHES_UNSUPPORTED);
        left = { type: 'binary', operator: 'matches', left, right: this.parseConcat() };
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

  /**
   * `same as(value)` / `divisible by(number)`: Twig's two tests that take an argument, each named in two words.
   *
   * Without these, `x is same as(false)` read `same` as a variable nobody set and compared `x` with it — true exactly
   * when `x` was undefined, and the `as(false)` after it was silently dropped. A template testing a flag against
   * `false` got an unset flag as the match.
   */
  private matchWordedTest(): (typeof WORDED_TESTS)[number] | null {
    const start = this.pos;
    for (const test of WORDED_TESTS) {
      const [first, second] = test.split(' ');
      if (this.matchKeyword(first)) {
        this.skipWs();
        if (this.matchKeyword(second)) {
          return test;
        }

        this.pos = start;
      }
    }

    return null;
  }

  /** `starts with` / `ends with`: two words, so one is not enough to commit — `starts` alone is a name. */
  private matchAffixTest(): 'starts with' | 'ends with' | null {
    const start = this.pos;
    for (const word of ['starts', 'ends'] as const) {
      if (this.matchKeyword(word)) {
        if (this.matchKeyword('with')) {
          return word === 'starts' ? 'starts with' : 'ends with';
        }

        this.pos = start;
      }
    }

    return null;
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
    let left = this.parsePower();
    this.skipWs();
    for (let ch = this.peek(); ch === Char.Star || ch === Char.Slash || ch === Char.Percent; ch = this.peek()) {
      // `**` binds tighter and is parsed below; left here it would read as `*` and a dangling `*`.
      if (ch === Char.Star && this.at(1) === Char.Star) {
        break;
      }

      const floor = ch === Char.Slash && this.at(1) === Char.Slash;
      this.pos += floor ? 2 : 1;
      const operator = floor ? '//' : ch === Char.Star ? '*' : ch === Char.Slash ? '/' : '%';
      left = { type: 'binary', operator, left, right: this.parsePower() };
      this.skipWs();
    }

    return left;
  }

  // `**`, right-associative as in Twig: `2 ** 3 ** 2` is `2 ** 9`.
  private parsePower(): Expression {
    const base = this.parseDefault();
    this.skipWs();
    if (this.peek() !== Char.Star || this.at(1) !== Char.Star) {
      return base;
    }

    this.pos += 2;

    return { type: 'binary', operator: '**', left: base, right: this.parsePower() };
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
      this.expectChar(Char.RParen, 'a closing ")"');

      // `(rows|find('id', 3)).title`: a group is a value like any other, so it takes the same access chain a name
      // does. Without it the chain was never read and the group came back whole — the row, not its title.
      return this.maybeTrailingFilters(this.parseAccessChain(expr, null));
    }

    if (ch === Char.SingleQuote || ch === Char.DoubleQuote) {
      return this.maybeTrailingFilters({ type: 'literal', value: this.scanStringLiteral() });
    }

    if (isDigit(ch)) {
      return this.maybeTrailingFilters({ type: 'literal', value: this.scanNumber() });
    }

    // A literal is a value like any other, so `['a', 'b'][i]` and `{ a: 1 }.a` read the member they name.
    if (ch === Char.LBracket) {
      this.pos++;
      const array: Expression = { type: 'array', elements: this.parseArgList(Char.RBracket) };

      return this.maybeTrailingFilters(this.parseAccessChain(array, null));
    }

    if (ch === Char.LBrace) {
      this.pos++;
      return this.maybeTrailingFilters(this.parseAccessChain(this.parseObjectLiteral(), null));
    }

    // Check for single-param arrow function: param =>
    return this.parsePathOrFunctionOrArrow();
  }

  // Tries to parse arrow function params inside parentheses (the cursor sits just past the `(`).
  // Returns the param names for `() =>`, `(name) =>` or `(name1, name2) =>`, or null when this is not an arrow.
  private tryParseArrowParams(): string[] | null {
    const startPos = this.pos;
    const params: string[] = [];
    this.skipWs();

    // Read the identifier list; an empty list (`()`) is valid and falls straight through to the `) =>` check.
    while (this.peek() !== Char.RParen) {
      const name = this.scanName();
      if (!name) {
        this.pos = startPos;
        return null;
      }

      params.push(name);
      this.skipWs();
      if (this.peek() === Char.Comma) {
        this.pos++;
        this.skipWs();
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
      this.report(
        this.eof()
          ? `Missing a value at the end of "${this.src.trim()}"`
          : `Unexpected "${this.src.slice(this.pos).trim()}" in "${this.src.trim()}"`
      );
      this.pos++;
      return { type: 'literal', value: '' };
    }

    if (name === 'true' || name === 'false') {
      return this.maybeTrailingFilters({ type: 'literal', value: name === 'true' });
    }

    // Twig's null, in either spelling. Read as a name it was a variable nobody set — `undefined` — so
    // `x is same as(null)` could never hold, and `x == null` answered for a value that did not exist.
    if (name === 'null' || name === 'none') {
      return this.maybeTrailingFilters({ type: 'literal', value: null });
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

      return this.maybeTrailingFilters(this.parseAccessChain({ type: 'function', name, args }, null));
    }

    const segments = [name];

    return this.maybeTrailingFilters(this.parseAccessChain({ type: 'path', segments }, segments));
  }

  /**
   * The access chain after a base expression — `.name`, `.0` and `[expr]`, in any order and any number.
   *
   * A run of keys the parse already knows stays ONE `path` node: `items.0.title` and `items[0].title` are the same
   * three segments, resolved by the evaluator's flat walk, and are also the shape everything that reads a template
   * statically expects to find (the RSC projection collects `<source>.<path>` strings, and a numeric segment is
   * what tells it to project every row rather than one).
   *
   * `segments` is that run and `base` is the node built from it — two views of one array, which is why extending
   * either extends both. Passing `null` says there is no run to extend: a function's result has no path of its own.
   * From the first bracket the parse cannot fold, the rest of the chain becomes `index` nodes over whatever came
   * before, so `rows[page - 1].title` works without every access paying for the general case.
   */
  private parseAccessChain(base: Expression, segments: string[] | null): Expression {
    let node = base;
    let staticRun = segments;

    for (;;) {
      const ch = this.peek();
      if (ch === Char.Dot) {
        const start = this.pos;
        this.pos++;
        const key = this.scanName() || this.scanIndex();
        if (!key) {
          // Not a segment: `a.` at the end of an expression, or the `..` of a range. Give the character back.
          this.pos = start;
          break;
        }

        if (staticRun) {
          staticRun.push(key);
        } else {
          node = { type: 'index', object: node, index: { type: 'literal', value: key } };
        }

        continue;
      }

      if (ch !== Char.LBracket) {
        break;
      }

      this.pos++;
      const index = this.parseTernary();
      this.expectChar(Char.RBracket, 'a closing "]"');

      // A literal subscript is the same thing as a dotted key, so it joins the run rather than ending it.
      if (
        staticRun &&
        index.type === 'literal' &&
        (typeof index.value === 'string' || typeof index.value === 'number')
      ) {
        staticRun.push(String(index.value));
        continue;
      }

      if (staticRun) {
        node = { type: 'path', segments: staticRun };
        staticRun = null;
      }

      node = { type: 'index', object: node, index };
    }

    return staticRun ? { type: 'path', segments: staticRun } : node;
  }

  // Wraps a subject expression in a FilterExpression when a `| filter` chain follows it.
  private maybeTrailingFilters(subject: Expression): Expression {
    this.skipWs();
    if (this.peek() !== Char.Pipe) {
      return subject;
    }

    return { type: 'filter', subject, filters: this.parseTrailingFilters() };
  }

  // Parses a hash literal `{ key: expr, … }` from a cursor sitting just past the `{`; the closing `}` is
  // consumed. Keys may be a bare identifier, a quoted string, an integer, or a dynamic `(expr)` — see parseKey.
  private parseObjectLiteral(): Expression {
    const entries: { key: Expression; value: Expression }[] = [];
    this.skipWs();
    while (!this.eof() && this.peek() !== Char.RBrace) {
      const key = this.parseObjectKey();
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

    this.expectChar(Char.RBrace, 'a closing "}"');

    return { type: 'object', entries };
  }

  // Parses a hash key: a quoted string, an integer, a dynamic `(expr)`, or a bare identifier (shorthand,
  // treated as a string literal). Returns the key as an expression evaluated when the hash is built.
  private parseObjectKey(): Expression {
    const ch = this.peek();
    if (ch === Char.SingleQuote || ch === Char.DoubleQuote) {
      return { type: 'literal', value: this.scanStringLiteral() };
    }

    if (isDigit(ch)) {
      return { type: 'literal', value: this.scanNumber() };
    }

    if (ch === Char.LParen) {
      this.pos++;
      this.skipWs();
      const expr = this.parseTernary();
      this.skipWs();
      if (this.peek() === Char.RParen) {
        this.pos++;
      }

      return expr;
    }

    return { type: 'literal', value: this.scanName() };
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

    this.expectChar(closeChar, closeChar === Char.RParen ? 'a closing ")"' : 'a closing "]"');

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
    if (!name) {
      this.report(`A "|" with no filter name after it in "${this.src.trim()}"`);
    }

    this.skipWs();
    if (this.peek() === Char.LParen) {
      this.pos++;
      return { name, args: this.parseArgList(Char.RParen) };
    }

    return { name, args: [] };
  }
}
