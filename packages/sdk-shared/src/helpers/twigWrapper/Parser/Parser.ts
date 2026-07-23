import { reconstructSource } from '../Lexer';
import { parseExpression, parseFilterChain } from './ExpressionParser';
import { extractFirstWord, isSimpleIdentifier } from './helpers';

import type {
  ASTNode,
  Expression,
  IfNode,
  ForNode,
  SetNode,
  ApplyNode,
  VariableNode,
  TextNode,
  RangeNode
} from '../AST';
import type { Token } from '../Lexer';
import type { ParseResult } from './types';

export const parse = (tokens: readonly Token[], keepEmptyTokens = false): ParseResult => {
  const ctx = new ParseContext(tokens, keepEmptyTokens);
  const nodes = ctx.parseBody();

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
  private readonly keepEmptyTokens: boolean;
  private pos = 0;
  error: string | null = null;

  constructor(tokens: readonly Token[], keepEmptyTokens = false) {
    this.tokens = tokens;
    this.keepEmptyTokens = keepEmptyTokens;
  }

  peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  advance(): Token | undefined {
    const token = this.tokens[this.pos];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (token) {
      this.pos++;
    }
    return token;
  }

  isTag(keyword: string): boolean {
    const token = this.peek();
    if (!token || token.type !== 'tag') {
      return false;
    }
    const trimmed = token.content.trim();
    return trimmed === keyword || trimmed.startsWith(keyword + ' ') || trimmed.startsWith(keyword + '\t');
  }

  parseBody(): ASTNode[] {
    const nodes: ASTNode[] = [];

    while (this.pos < this.tokens.length) {
      const token = this.peek();
      if (!token) {
        break;
      }

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
    const source = this.keepEmptyTokens ? reconstructSource(token.content, token.raw) : '';
    if (isSimpleIdentifier(trimmed)) {
      return {
        type: 'variable',
        raw: token.raw,
        expression: { type: 'path', segments: [trimmed] },
        source
      };
    }
    const expr = parseExpression(trimmed);
    return { type: 'variable', raw: token.raw, expression: expr, source };
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
        this.advance();
        return null;
    }
  }

  private parseIf(): IfNode {
    this.advance();
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
    this.advance();
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

    const commaIdx = varsStr.indexOf(',');
    let valueVar: string;
    let keyVar: string | null = null;
    if (commaIdx !== -1) {
      keyVar = varsStr.slice(0, commaIdx).trim();
      valueVar = varsStr.slice(commaIdx + 1).trim();
    } else {
      valueVar = varsStr;
    }

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

    if (this.peek()) {
      const token = this.peek();
      if (token && token.type === 'tag' && extractFirstWord(token.content.trim()) === 'else') {
        this.advance();
        elseBody = this.parseBody();
      }
    }

    const endForToken = this.peek();
    if (endForToken && endForToken.type === 'tag' && extractFirstWord(endForToken.content.trim()) === 'endfor') {
      this.advance();
    } else {
      this.error = 'Malformed {% for %} block: missing {% endfor %}';
    }

    return { type: 'for', valueVar, keyVar, collection, body, elseBody };
  }

  private parseSet(): SetNode {
    this.advance();
    const prevToken = this.tokens[this.pos - 1];
    if (prevToken.type !== 'tag') {
      return { type: 'set', name: '_unknown', value: { type: 'literal', value: '' } };
    }
    const content = prevToken.content.trim();
    const rest = content.slice(content.indexOf(' ') + 1).trim();
    const eqIdx = rest.indexOf('=');

    if (eqIdx === -1) {
      const name = rest.trim();
      const body = this.parseBody();
      const endSetToken = this.peek();
      if (endSetToken && endSetToken.type === 'tag') {
        this.advance();
      }
      return { type: 'set', name, value: body };
    }

    const name = rest.slice(0, eqIdx).trim();
    const exprStr = rest.slice(eqIdx + 1).trim();
    const value = parseExpression(exprStr);
    return { type: 'set', name, value };
  }

  private parseApply(): ApplyNode {
    this.advance();
    const prevToken = this.tokens[this.pos - 1];
    if (prevToken.type !== 'tag') {
      return { type: 'apply', filters: [], body: [] };
    }
    const content = prevToken.content.trim();
    const filtersStr = content.slice(content.indexOf(' ') + 1).trim();
    const filters = parseFilterChain('| ' + filtersStr);
    const body = this.parseBody();

    const endApplyToken = this.peek();
    if (endApplyToken && endApplyToken.type === 'tag') {
      this.advance();
    }

    return { type: 'apply', filters, body };
  }
}
