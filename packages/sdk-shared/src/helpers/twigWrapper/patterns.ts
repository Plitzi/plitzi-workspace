// The regex grammar shared across the twigWrapper modules.

// A token segment allows internal hyphens (a source idRef is `<type>_<idRef>` and an idRef may carry them), but
// never a leading or trailing one — the segment starts on `[a-zA-Z_]` and every '-' is followed by more word
// chars. Resolution splits the path and reads each segment as a literal key, so a hyphen is never arithmetic.
const TOKEN_SEGMENT = '[a-zA-Z_][a-zA-Z0-9_]*(?:-[a-zA-Z0-9_]+)*';
const TOKEN_PATH = `${TOKEN_SEGMENT}(?:\\??\\.${TOKEN_SEGMENT})*`;

// A well-formed token, for detection: `{{ path [?? default] [| filter]... }}`, whitespace anywhere. Deliberately
// strict and kept in step with TOKEN_INNER — templates are user-written, so `{{var 1}}`, `{{var.1}}`, `{{ x | }}`
// and `{{}}` must read as malformed (not a token) exactly as renderTokens then declines to resolve them.
const TOKEN_BASE = `\\{\\{\\s*${TOKEN_PATH}(?:\\s*\\?\\?\\s*[^|{}]+?)?(?:\\s*\\|\\s*[a-zA-Z_]+(?:\\([^)]*\\))?)*\\s*\\}\\}`;
export const TOKEN_REGEX = new RegExp(TOKEN_BASE, 'g');
export const TOKEN_STRICT_REGEX = new RegExp(`^${TOKEN_BASE}$`);

// A `{{ ... }}` occurrence, and the grammar of its contents: a path, an optional `?? default`, optional filters.
export const TOKEN_MATCH = /\{\{([\s\S]*?)\}\}/g;
export const TOKEN_INNER = new RegExp(
  `^\\s*(${TOKEN_PATH})\\s*(?:\\?\\?\\s*([^|]+?)\\s*)?((?:\\|\\s*[a-zA-Z_]+(?:\\([^)]*\\))?\\s*)*)$`
);
export const FILTER_RE = /\|\s*([a-zA-Z_]+)(?:\(([^)]*)\))?/g;

// A single well-formed `{% if %}` block. The condition may not cross `%}`, and the then/else bodies hold no
// structural tag (`if`/`else`/`endif`), so a match is always an innermost, correctly paired block — repeated
// replacement then resolves inner blocks before their parents. A block missing its `%}` or `{% endif %}`, or with
// an empty condition, simply never matches and is left in place rather than half-rendered. `else` is optional.
const IF_BODY = '(?:(?!\\{%\\s*(?:if|else|endif)\\b)[\\s\\S])*?';
export const IF_BLOCK = new RegExp(
  `\\{%\\s*if\\s+((?:(?!%\\})[\\s\\S])+?)\\s*%\\}(${IF_BODY})(?:\\{%\\s*else\\s*%\\}(${IF_BODY}))?\\{%\\s*endif\\s*%\\}`
);
export const COMPARISON = /^([\s\S]+?)\s*(==|!=|>=|<=|>|<)\s*([\s\S]+)$/;
export const STRING_LITERAL = /^(['"])([\s\S]*)\1$/;
