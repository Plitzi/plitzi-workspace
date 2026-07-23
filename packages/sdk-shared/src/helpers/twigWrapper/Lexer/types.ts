export type Token =
  | { readonly type: 'text'; readonly value: string }
  | { readonly type: 'variable'; readonly content: string; readonly raw: boolean }
  | { readonly type: 'tag'; readonly content: string };

export type LexResult = {
  tokens: Token[];
  error: string | null;
};

export const reconstructSource = (content: string, raw: boolean): string =>
  raw ? `{{{${content}}}}` : `{{${content}}}`;

// Reconstructs a token's original template text verbatim (the lexer preserves inner spacing on tags and
// variables), so a run of tokens can be re-emitted exactly — used to preserve unresolved blocks.
export const reconstructToken = (token: Token): string => {
  switch (token.type) {
    case 'text':
      return token.value;
    case 'variable':
      return reconstructSource(token.content, token.raw);
    case 'tag':
      return `{%${token.content}%}`;
  }
};
