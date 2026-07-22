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
