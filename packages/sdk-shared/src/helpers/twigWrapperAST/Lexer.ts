// Lexer: tokenizes a Twig template into a stream of tokens.
// The lexer scans left-to-right, finding `{{`, `{{{`, or `{%` delimiters
// and emitting the text content and tag content between them.

export type Token =
  | { readonly type: 'text'; readonly value: string }
  | { readonly type: 'variable'; readonly content: string; readonly raw: boolean }
  | { readonly type: 'tag'; readonly content: string };

export type LexResult = {
  readonly tokens: readonly Token[];
  readonly error: string | null;
};

// Reconstructs the original source text of a variable token.
// Used only when keepEmptyTokens is enabled.
export const reconstructSource = (content: string, raw: boolean): string =>
  raw ? `{{{${content}}}}` : `{{${content}}}`;

// Scans the template and returns a flat list of tokens.
// Returns error if an unclosed tag is found (e.g. `{{ invalid `).
export const lex = (template: string): LexResult => {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < template.length) {
    // Find the next occurrence of `{{` or `{%`.
    const nextOpen = template.indexOf('{{', pos);
    const nextTag = template.indexOf('{%', pos);

    // Pick whichever comes first.
    let nextPos: number;
    let isTag: boolean;
    if (nextOpen === -1 && nextTag === -1) {
      break;
    } else if (nextOpen === -1) {
      nextPos = nextTag;
      isTag = true;
    } else if (nextTag === -1) {
      nextPos = nextOpen;
      isTag = false;
    } else if (nextOpen < nextTag) {
      nextPos = nextOpen;
      isTag = false;
    } else {
      nextPos = nextTag;
      isTag = true;
    }

    // Emit text before the delimiter.
    if (nextPos > pos) {
      tokens.push({ type: 'text', value: template.slice(pos, nextPos) });
    }

    // Check for triple braces `{{{`.
    if (!isTag && template.charCodeAt(nextPos + 2) === 123) {
      // Triple brace: `{{{ content }}}`
      const closePos = template.indexOf('}}}', nextPos + 3);
      if (closePos === -1) {
        return { tokens, error: 'Unclosed triple-brace token' };
      }
      tokens.push({ type: 'variable', content: template.slice(nextPos + 3, closePos), raw: true });
      pos = closePos + 3;
    } else if (!isTag) {
      // Double brace: `{{ content }}`
      const closePos = template.indexOf('}}', nextPos + 2);
      if (closePos === -1) {
        return { tokens, error: 'Unclosed double-brace token' };
      }
      tokens.push({ type: 'variable', content: template.slice(nextPos + 2, closePos), raw: false });
      pos = closePos + 2;
    } else {
      // Tag: `{% content %}`
      const closePos = template.indexOf('%}', nextPos + 2);
      if (closePos === -1) {
        return { tokens, error: 'Unclosed tag' };
      }
      tokens.push({ type: 'tag', content: template.slice(nextPos + 2, closePos) });
      pos = closePos + 2;
    }
  }

  // Emit trailing text.
  if (pos < template.length) {
    tokens.push({ type: 'text', value: template.slice(pos) });
  }

  return { tokens, error: null };
};
