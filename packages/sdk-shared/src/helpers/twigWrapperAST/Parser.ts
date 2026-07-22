import { reconstructSource } from './Lexer';

import type {
  ASTNode,
  Expression,
  FilterCall,
  IfNode,
  ForNode,
  SetNode,
  ApplyNode,
  VariableNode,
  TextNode,
  LiteralNode,
  ArrayLiteralNode,
  RangeNode
} from './AST';
import type { Token } from './Lexer';

export type ParseResult = {
  readonly nodes: readonly ASTNode[];
  readonly error: string | null;
};

// Extracts the first word from a trimmed string without allocating an array.
const extractFirstWord = (s: string): string => {
  const len = s.length;
  let i = 0;
  while (i < len && s.charCodeAt(i) !== 32 && s.charCodeAt(i) !== 9) {
    i++;
  }
  return s.slice(0, i);
};

// Checks if a string is a simple identifier (letters, digits, underscores only).
// Used to fast-path variable parsing — avoids the full expression parser.
const isSimpleIdentifier = (s: string): boolean => {
  const len = s.length;
  if (len === 0) {
    return false;
  }
  const ch = s.charCodeAt(0);
  if (!((ch >= 97 && ch <= 122) || (ch >= 65 && ch <= 90) || ch === 95)) {
    return false;
  }
  for (let i = 1; i < len; i++) {
    const c = s.charCodeAt(i);
    if ((c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57) || c === 95) {
      continue;
    }
    return false;
  }
  return true;
};

// Parser: converts a flat token stream into an AST.
// Uses recursive descent for nested blocks (if, for, set, apply).
export const parse = (tokens: readonly Token[]): ParseResult => {
  const ctx = new ParseContext(tokens);
  const nodes = ctx.parseBody();

  // Detect orphan end tags at the top level (e.g. `{% endif %}` without `{% if %}`).
  if (!ctx.error) {
    const remaining = ctx.peek();
    if (remaining && remaining.type === 'tag') {
      const kw = extractFirstWord(remaining.content.trim());
      if (
        kw === 'endif' ||
        kw === 'endfor' ||
        kw === 'endset' ||
        kw === 'endapply' ||
        kw === 'else' ||
        kw === 'elseif'
      ) {
        ctx.error = `Orphan closing tag: {% ${kw} %} without matching opening tag`;
      }
    }
  }

  return { nodes, error: ctx.error };
};

class ParseContext {
  private readonly tokens: readonly Token[];
  private pos = 0;
  error: string | null = null;

  constructor(tokens: readonly Token[]) {
    this.tokens = tokens;
  }

  // Returns the current token without consuming it.
  peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  // Returns the current token and advances.
  advance(): Token | undefined {
    const token = this.tokens[this.pos];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (token) {
      this.pos++;
    }
    return token;
  }

  // Returns true if the current tag content starts with the given keyword.
  isTag(keyword: string): boolean {
    const token = this.peek();
    if (!token || token.type !== 'tag') {
      return false;
    }
    const trimmed = token.content.trim();
    return trimmed === keyword || trimmed.startsWith(keyword + ' ') || trimmed.startsWith(keyword + '\t');
  }

  // Parse a sequence of nodes until we hit an end tag or run out of tokens.
  parseBody(): ASTNode[] {
    const nodes: ASTNode[] = [];

    while (this.pos < this.tokens.length) {
      const token = this.peek();
      if (!token) {
        break;
      }

      // Stop at end tags — the caller will handle them.
      if (token.type === 'tag') {
        const kw = extractFirstWord(token.content.trim());
        if (
          kw === 'endif' ||
          kw === 'endfor' ||
          kw === 'endset' ||
          kw === 'endapply' ||
          kw === 'else' ||
          kw === 'elseif'
        ) {
          break;
        }
      }

      const node = this.parseNode();
      if (node) {
        nodes.push(node);
      }
    }

    return nodes;
  }

  private parseNode(): ASTNode | null {
    const token = this.peek();
    if (!token) {
      return null;
    }

    if (token.type === 'text') {
      this.advance();
      return { type: 'text', value: token.value } satisfies TextNode;
    }

    if (token.type === 'variable') {
      return this.parseVariable();
    }

    return this.parseTag();
  }

  private parseVariable(): VariableNode {
    const token = this.advance();
    if (!token || token.type !== 'variable') {
      return { type: 'variable', raw: false, expression: { type: 'literal', value: '' }, source: '' };
    }
    const trimmed = token.content.trim();
    // Fast path: single identifier (no dots, pipes, operators) — skip the expression parser.
    if (isSimpleIdentifier(trimmed)) {
      return {
        type: 'variable',
        raw: token.raw,
        expression: { type: 'path', segments: [trimmed] },
        source: reconstructSource(token.content, token.raw)
      };
    }
    const expr = parseExpression(trimmed);
    return { type: 'variable', raw: token.raw, expression: expr, source: reconstructSource(token.content, token.raw) };
  }

  private parseTag(): ASTNode | null {
    const token = this.peek();
    if (!token || token.type !== 'tag') {
      return null;
    }
    const content = token.content.trim();
    const firstWord = extractFirstWord(content);

    switch (firstWord) {
      case 'if':
        return this.parseIf();
      case 'for':
        return this.parseFor();
      case 'set':
        return this.parseSet();
      case 'apply':
        return this.parseApply();
      case 'break':
        this.advance();
        return { type: 'break' };
      case 'continue':
        this.advance();
        return { type: 'continue' };
      default:
        // Unknown tag — skip it, it will be left as-is by the evaluator.
        this.advance();
        return null;
    }
  }

  private parseIf(): IfNode {
    this.advance(); // consume `{% if condition %}`
    const prevToken = this.tokens[this.pos - 1];
    if (prevToken.type !== 'tag') {
      this.error = 'Malformed {% if %} tag';
      return {
        type: 'if',
        condition: { type: 'literal', value: false },
        body: [],
        elseifClauses: [],
        elseBody: null
      };
    }
    const content = prevToken.content.trim();

    // Detect `{% if %}` with no condition (no space after `if`).
    if (content.indexOf(' ') === -1) {
      this.error = 'Malformed {% if %} tag: missing condition';
      return {
        type: 'if',
        condition: { type: 'literal', value: false },
        body: [],
        elseifClauses: [],
        elseBody: null
      };
    }

    const condExpr = content.slice(content.indexOf(' ') + 1).trim();

    if (!condExpr) {
      this.error = 'Malformed {% if %} tag: missing condition';
      return {
        type: 'if',
        condition: { type: 'literal', value: false },
        body: [],
        elseifClauses: [],
        elseBody: null
      };
    }

    const condition = parseExpression(condExpr);

    const body = this.parseBody();
    const elseifClauses: { condition: Expression; body: ASTNode[] }[] = [];
    let elseBody: ASTNode[] | null = null;
    let foundEndTag = false;

    while (this.peek()) {
      const token = this.peek();
      if (!token || token.type !== 'tag') {
        break;
      }
      const kw = extractFirstWord(token.content.trim());

      if (kw === 'elseif') {
        this.advance();
        const elifContent = token.content.trim();
        const elifExpr = elifContent.slice(elifContent.indexOf(' ') + 1).trim();
        const elifCondition = parseExpression(elifExpr);
        const elifBody = this.parseBody();
        elseifClauses.push({ condition: elifCondition, body: elifBody });
      } else if (kw === 'else') {
        this.advance();
        elseBody = this.parseBody();
      } else if (kw === 'endif') {
        this.advance();
        foundEndTag = true;
        break;
      } else {
        break;
      }
    }

    if (!foundEndTag) {
      this.error = 'Malformed {% if %} block: missing {% endif %}';
    }

    return { type: 'if', condition, body, elseifClauses, elseBody };
  }

  private parseFor(): ForNode {
    this.advance(); // consume `{% for ... in ... %}`
    const prevToken = this.tokens[this.pos - 1];
    if (prevToken.type !== 'tag') {
      return {
        type: 'for',
        valueVar: '_item',
        keyVar: null,
        collection: { type: 'literal', value: '' },
        body: [],
        elseBody: null
      };
    }
    const content = prevToken.content.trim();
    const forBody = content.slice(content.indexOf(' ') + 1).trim();
    const inIdx = forBody.indexOf(' in ');
    if (inIdx === -1) {
      this.error = 'Invalid {% for %} syntax: missing \'in\' keyword'; // eslint-disable-line prettier/prettier
      return {
        type: 'for',
        valueVar: '_item',
        keyVar: null,
        collection: { type: 'literal', value: '' },
        body: [],
        elseBody: null
      };
    }

    const varsStr = forBody.slice(0, inIdx).trim();
    const collectionStr = forBody.slice(inIdx + 4).trim();

    // Check for range expression: `start..end`
    const rangeMatch = /^(['"]?)(-?\w+)\1\s*\.\.\s*(['"]?)(-?\w+)\3$/.exec(collectionStr);
    let collection: Expression;
    if (rangeMatch) {
      const start = rangeMatch[2];
      const end = rangeMatch[4];
      const startExpr: Expression = /^\d+$/.test(start)
        ? { type: 'literal', value: Number(start) }
        : { type: 'path', segments: [start] };
      const endExpr: Expression = /^\d+$/.test(end)
        ? { type: 'literal', value: Number(end) }
        : { type: 'path', segments: [end] };
      collection = { type: 'range', start: startExpr, end: endExpr } satisfies RangeNode;
    } else {
      collection = parseExpression(collectionStr);
    }

    // Parse `key, value` or just `value`.
    const commaIdx = varsStr.indexOf(',');
    let valueVar: string;
    let keyVar: string | null = null;
    if (commaIdx !== -1) {
      keyVar = varsStr.slice(0, commaIdx).trim();
      valueVar = varsStr.slice(commaIdx + 1).trim();
    } else {
      valueVar = varsStr;
    }

    // Validate variable names — reject empty or malformed declarations.
    if (!valueVar || !/^\w+$/.test(valueVar)) {
      this.error = `Invalid {% for %} variable name: "${valueVar}"`;
      return {
        type: 'for',
        valueVar: '_item',
        keyVar: null,
        collection: { type: 'literal', value: '' },
        body: [],
        elseBody: null
      };
    }
    if (keyVar !== null && !/^\w+$/.test(keyVar)) {
      this.error = `Invalid {% for %} key variable name: "${keyVar}"`;
      return {
        type: 'for',
        valueVar: '_item',
        keyVar: null,
        collection: { type: 'literal', value: '' },
        body: [],
        elseBody: null
      };
    }

    const body = this.parseBody();
    let elseBody: ASTNode[] | null = null;

    // Check for `{% else %}` before `{% endfor %}`.
    if (this.peek()) {
      const token = this.peek();
      if (token && token.type === 'tag' && extractFirstWord(token.content.trim()) === 'else') {
        this.advance();
        elseBody = this.parseBody();
      }
    }

    // Consume `{% endfor %}`.
    const endForToken = this.peek();
    if (endForToken && endForToken.type === 'tag' && extractFirstWord(endForToken.content.trim()) === 'endfor') {
      this.advance();
    } else {
      this.error = 'Malformed {% for %} block: missing {% endfor %}';
    }

    return { type: 'for', valueVar, keyVar, collection, body, elseBody };
  }

  private parseSet(): SetNode {
    this.advance(); // consume `{% set ... %}`
    const prevToken = this.tokens[this.pos - 1];
    if (prevToken.type !== 'tag') {
      return { type: 'set', name: '_unknown', value: { type: 'literal', value: '' } };
    }
    const content = prevToken.content.trim();
    const rest = content.slice(content.indexOf(' ') + 1).trim();
    const eqIdx = rest.indexOf('=');

    if (eqIdx === -1) {
      // Block set: `{% set var %}...{% endset %}`
      const name = rest.trim();
      const body = this.parseBody();
      // Consume `{% endset %}`.
      const endSetToken = this.peek();
      if (endSetToken && endSetToken.type === 'tag') {
        this.advance();
      }
      return { type: 'set', name, value: body };
    }

    // Assignment set: `{% set var = expr %}`
    const name = rest.slice(0, eqIdx).trim();
    const exprStr = rest.slice(eqIdx + 1).trim();
    const value = parseExpression(exprStr);
    return { type: 'set', name, value };
  }

  private parseApply(): ApplyNode {
    this.advance(); // consume `{% apply ... %}`
    const prevToken = this.tokens[this.pos - 1];
    if (prevToken.type !== 'tag') {
      return { type: 'apply', filters: [], body: [] };
    }
    const content = prevToken.content.trim();
    const filtersStr = content.slice(content.indexOf(' ') + 1).trim();
    const filters = parseFilterChain(filtersStr);
    const body = this.parseBody();

    // Consume `{% endapply %}`.
    const endApplyToken = this.peek();
    if (endApplyToken && endApplyToken.type === 'tag') {
      this.advance();
    }

    return { type: 'apply', filters, body };
  }
}

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

const parseExpression = (expr: string): Expression => {
  const parser = new ExpressionParser(expr);
  return parser.parseOr();
};

class ExpressionParser {
  private readonly src: string;
  private pos = 0;

  constructor(src: string) {
    this.src = src;
  }

  // Skip whitespace.
  private skipWs(): void {
    while (
      this.pos < this.src.length &&
      (this.src.charCodeAt(this.pos) === 32 || this.src.charCodeAt(this.pos) === 9)
    ) {
      this.pos++;
    }
  }

  // Peek at the current character.
  private peekChar(): number {
    return this.pos < this.src.length ? this.src.charCodeAt(this.pos) : -1;
  }

  // Parse: or (lowest precedence).
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

  // Parse: and.
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

  // Parse: not (unary).
  parseNot(): Expression {
    this.skipWs();
    if (this.matchKeyword('not')) {
      const operand = this.parseComparison();
      return { type: 'unary', operator: 'not', operand };
    }
    return this.parseComparison();
  }

  // Parse: comparisons (==, !=, >=, <=, >, <, in, not in, is, is not) and ~ (concatenation).
  parseComparison(): Expression {
    let left = this.parseConcat();
    this.skipWs();

    while (this.pos < this.src.length) {
      // Check for `is not` first (two words).
      if (this.matchKeyword('is')) {
        this.skipWs();
        if (this.matchKeyword('not')) {
          const right = this.parseConcat();
          left = { type: 'binary', operator: 'is not', left, right };
          this.skipWs();
          continue;
        }
        // Just `is` — treat as `is not` with empty right? No, in Twig `is` alone isn't valid.
        // But our existing implementation treats `is` as equality check? Let's match existing behavior.
        const right = this.parseConcat();
        left = { type: 'binary', operator: 'is', left, right };
        this.skipWs();
        continue;
      }

      // Check for `not in` (two words).
      if (this.matchKeyword('not')) {
        this.skipWs();
        if (this.matchKeyword('in')) {
          const right = this.parseConcat();
          left = { type: 'binary', operator: 'not in', left, right };
          this.skipWs();
          continue;
        }
        // Not followed by `in` — backtrack. We consumed 'not' already.
        // In practice, `not` at this level should have been caught by parseNot().
        // This is an error case; just treat as unary not of the rest.
        const rest = this.src.slice(this.pos - 4); // back before 'not'
        this.pos = this.src.length; // consume everything
        return { type: 'unary', operator: 'not', operand: parseExpression(rest) };
      }

      // Binary operators.
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

  // Parse: ~ (concatenation, left-assoc).
  parseConcat(): Expression {
    let left = this.parseDefault();
    this.skipWs();
    while (this.pos < this.src.length && this.src.charCodeAt(this.pos) === 126) {
      // ~
      this.pos++;
      const right = this.parseDefault();
      // If left is already a concat, merge parts.
      if (left.type === 'concat') {
        left = { type: 'concat', parts: [...left.parts, right] };
      } else {
        left = { type: 'concat', parts: [left, right] };
      }
      this.skipWs();
    }
    return left;
  }

  // Parse: ?? (default / null coalescing).
  parseDefault(): Expression {
    let left = this.parseAtom();
    this.skipWs();
    if (this.peekChar() === 63 && this.src.charCodeAt(this.pos + 1) === 63) {
      // ??
      this.pos += 2;
      const defaultExpr = this.parseAtom();
      left = { type: 'default', value: left, defaultExpr };
    }
    return left;
  }

  // Parse: atoms — literals, paths, function calls, parenthesized expressions.
  parseAtom(): Expression {
    this.skipWs();
    const ch = this.peekChar();

    // Parenthesized expression.
    if (ch === 40) {
      // (
      this.pos++;
      const expr = this.parseOr();
      this.skipWs();
      if (this.peekChar() === 41) {
        // )
        this.pos++;
      }
      return expr;
    }

    // String literal.
    if (ch === 39 || ch === 34) {
      // ' or "
      return this.parseStringLiteral();
    }

    // Number literal (including negative).
    if (ch === 45 || (ch >= 48 && ch <= 57)) {
      // - or 0-9
      return this.parseNumberLiteral();
    }

    // Array literal `[...]`.
    if (ch === 91) {
      // [
      return this.parseArrayLiteral();
    }

    // Boolean keywords and path/function.
    return this.parsePathOrFunction();
  }

  private parseStringLiteral(): LiteralNode {
    const quote = this.src[this.pos];
    this.pos++;
    let value = '';
    while (this.pos < this.src.length && this.src[this.pos] !== quote) {
      value += this.src[this.pos];
      this.pos++;
    }
    if (this.pos < this.src.length) {
      this.pos++; // skip closing quote
    }
    return { type: 'literal', value };
  }

  private parseNumberLiteral(): LiteralNode {
    const start = this.pos;
    if (this.src.charCodeAt(this.pos) === 45) {
      // -
      this.pos++;
    }
    while (this.pos < this.src.length && this.src.charCodeAt(this.pos) >= 48 && this.src.charCodeAt(this.pos) <= 57) {
      this.pos++;
    }
    // Optional decimal.
    if (this.pos < this.src.length && this.src.charCodeAt(this.pos) === 46) {
      this.pos++;
      while (this.pos < this.src.length && this.src.charCodeAt(this.pos) >= 48 && this.src.charCodeAt(this.pos) <= 57) {
        this.pos++;
      }
    }
    const num = Number(this.src.slice(start, this.pos));
    return { type: 'literal', value: num };
  }

  private parseArrayLiteral(): Expression {
    this.pos++; // skip [
    const elements: Expression[] = [];
    this.skipWs();
    while (this.pos < this.src.length && this.peekChar() !== 93) {
      // ]
      elements.push(this.parseOr());
      this.skipWs();
      if (this.peekChar() === 44) {
        // ,
        this.pos++;
        this.skipWs();
      }
    }
    if (this.peekChar() === 93) {
      // ]
      this.pos++;
    }
    return { type: 'array', elements } satisfies ArrayLiteralNode;
  }

  private parsePathOrFunction(): Expression {
    const start = this.pos;
    // Read the identifier.
    while (
      this.pos < this.src.length &&
      ((this.src.charCodeAt(this.pos) >= 97 && this.src.charCodeAt(this.pos) <= 122) || // a-z
        (this.src.charCodeAt(this.pos) >= 65 && this.src.charCodeAt(this.pos) <= 90) || // A-Z
        (this.src.charCodeAt(this.pos) >= 48 && this.src.charCodeAt(this.pos) <= 57) || // 0-9
        this.src.charCodeAt(this.pos) === 95 || // _
        this.src.charCodeAt(this.pos) === 45) // -
    ) {
      this.pos++;
    }

    const name = this.src.slice(start, this.pos);
    if (!name) {
      // Unknown character — consume it to avoid infinite loop.
      this.pos++;
      return { type: 'literal', value: '' };
    }

    // Check for boolean keywords.
    if (name === 'true') {
      return { type: 'literal', value: true };
    }
    if (name === 'false') {
      return { type: 'literal', value: false };
    }

    // Check for function call: `name(...)`.
    this.skipWs();
    if (this.peekChar() === 40) {
      // (
      this.pos++;
      const args: Expression[] = [];
      this.skipWs();
      while (this.pos < this.src.length && this.peekChar() !== 41) {
        // )
        args.push(this.parseOr());
        this.skipWs();
        if (this.peekChar() === 44) {
          // ,
          this.pos++;
          this.skipWs();
        }
      }
      if (this.peekChar() === 41) {
        // )
        this.pos++;
      }
      // Apply filters after function call.
      this.skipWs();
      if (this.peekChar() === 124) {
        // |
        const filters = this.parseFilterChainFromPos();
        return { type: 'filter', subject: { type: 'function', name, args }, filters };
      }
      return { type: 'function', name, args };
    }

    // Check for path: `name.segment.segment`.
    const segments: string[] = [name];
    while (this.peekChar() === 46) {
      // .
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

    // Apply filters after path.
    this.skipWs();
    if (this.peekChar() === 124) {
      // |
      const filters = this.parseFilterChainFromPos();
      return { type: 'filter', subject: { type: 'path', segments }, filters };
    }

    return { type: 'path', segments };
  }

  // Parse filter chain starting from current position (after `|`).
  private parseFilterChainFromPos(): readonly FilterCall[] {
    const filters: FilterCall[] = [];
    while (this.peekChar() === 124) {
      // |
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
        // (
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
          // )
          this.pos++;
        }
      }
      if (filterName) {
        filters.push({ name: filterName, arg: filterArg || null });
      }
    }
    return filters;
  }

  // Try to match a keyword at the current position (followed by whitespace or end).
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
    // Must be followed by whitespace, end, or a non-alphanumeric char (except for special chars in operators).
    if (end < this.src.length) {
      const next = this.src.charCodeAt(end);
      // Allow keyword to be followed by operator chars like `(`, `)`, `~`, etc.
      if ((next >= 97 && next <= 122) || (next >= 65 && next <= 90) || (next >= 48 && next <= 57) || next === 95) {
        return false;
      }
    }
    this.pos = end;
    this.skipWs();
    return true;
  }

  // Match a binary operator and return its string representation.
  private matchBinaryOp(): string | null {
    this.skipWs();
    const ch = this.peekChar();

    // Two-char operators.
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

    // Single-char operators.
    if (ch === 62) {
      // >
      this.pos++;
      return '>';
    }
    if (ch === 60) {
      // <
      this.pos++;
      return '<';
    }

    return null;
  }
}

// Parse a filter chain string like `| upper | truncate(10)` into FilterCall[].
const parseFilterChain = (filtersStr: string): FilterCall[] => {
  const filters: FilterCall[] = [];
  const matches = filtersStr.matchAll(/\|\s*([a-zA-Z0-9_]+)(?:\(([^)]*)\))?/g);
  for (const match of matches) {
    // match[2] is undefined when the optional capture group doesn't match
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    filters.push({ name: match[1], arg: match[2] ?? null });
  }
  return filters;
};
