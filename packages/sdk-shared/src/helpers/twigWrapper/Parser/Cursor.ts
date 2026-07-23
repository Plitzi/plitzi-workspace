import { Char, isDigit, isIdentPart, isIdentStart, isPathPart, isSpace } from '../charClass';

// A forward-only character cursor over an expression string. It owns every raw character-scanning concern —
// whitespace, identifiers, string/number literals, keyword and operator matching — so that ExpressionParser
// is left with just the grammar that assembles those pieces into AST nodes.
export class Cursor {
  protected readonly src: string;
  protected pos = 0;

  constructor(src: string) {
    this.src = src;
  }

  protected eof(): boolean {
    return this.pos >= this.src.length;
  }

  // Char code at the current position, or -1 at end of input.
  protected peek(): number {
    return this.pos < this.src.length ? this.src.charCodeAt(this.pos) : -1;
  }

  // Char code `offset` characters ahead, or -1 past the end.
  protected at(offset: number): number {
    const i = this.pos + offset;
    return i < this.src.length ? this.src.charCodeAt(i) : -1;
  }

  protected skipWs(): void {
    while (this.pos < this.src.length && isSpace(this.src.charCodeAt(this.pos))) {
      this.pos++;
    }
  }

  // Scans an identifier / path segment (`[a-zA-Z_][a-zA-Z0-9_-]*`), returning '' when not on one.
  protected scanName(): string {
    const start = this.pos;
    if (!this.eof() && isIdentStart(this.src.charCodeAt(this.pos))) {
      this.pos++;
      while (!this.eof() && isPathPart(this.src.charCodeAt(this.pos))) {
        this.pos++;
      }
    }

    return this.src.slice(start, this.pos);
  }

  // Reads a quoted string literal's contents (cursor sits on the opening quote) and consumes the closing quote.
  protected scanStringLiteral(): string {
    const quote = this.src.charCodeAt(this.pos);
    const start = ++this.pos;
    while (this.pos < this.src.length && this.src.charCodeAt(this.pos) !== quote) {
      this.pos++;
    }

    const value = this.src.slice(start, this.pos);
    if (this.pos < this.src.length) {
      this.pos++;
    }

    return value;
  }

  // Reads a numeric literal: optional leading `-`, integer digits, optional fractional part.
  protected scanNumber(): number {
    const start = this.pos;
    if (this.src.charCodeAt(this.pos) === Char.Minus) {
      this.pos++;
    }

    while (this.pos < this.src.length && isDigit(this.src.charCodeAt(this.pos))) {
      this.pos++;
    }

    if (this.src.charCodeAt(this.pos) === Char.Dot) {
      this.pos++;
      while (this.pos < this.src.length && isDigit(this.src.charCodeAt(this.pos))) {
        this.pos++;
      }
    }

    return Number(this.src.slice(start, this.pos));
  }

  // Matches a bare-word keyword (`and`, `or`, `not`, `in`, `is`) that is not the prefix of a longer
  // identifier; advances past it and trailing whitespace on success.
  protected matchKeyword(kw: string): boolean {
    const end = this.pos + kw.length;
    if (end > this.src.length) {
      return false;
    }

    for (let i = 0; i < kw.length; i++) {
      if (this.src.charCodeAt(this.pos + i) !== kw.charCodeAt(i)) {
        return false;
      }
    }

    if (end < this.src.length && isIdentPart(this.src.charCodeAt(end))) {
      return false;
    }

    this.pos = end;
    this.skipWs();
    return true;
  }

  // Matches a comparison operator symbol (`==`, `!=`, `>=`, `<=`, `>`, `<`) at the cursor, or returns null.
  protected matchBinaryOp(): string | null {
    this.skipWs();
    const c0 = this.peek();
    if (this.at(1) === Char.Equals) {
      if (c0 === Char.Equals) {
        this.pos += 2;
        return '==';
      }
      if (c0 === Char.Bang) {
        this.pos += 2;
        return '!=';
      }
      if (c0 === Char.Greater) {
        this.pos += 2;
        return '>=';
      }
      if (c0 === Char.Less) {
        this.pos += 2;
        return '<=';
      }
    }

    if (c0 === Char.Greater) {
      this.pos++;
      return '>';
    }
    if (c0 === Char.Less) {
      this.pos++;
      return '<';
    }

    return null;
  }
}
