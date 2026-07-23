// Detection grammar for `hasValidToken`. A token segment allows internal hyphens (a source idRef is
// `<type>_<idRef>` and an idRef may carry them), but never a leading or trailing one — the segment starts on
// `[a-zA-Z_]` and every '-' is followed by more word chars. Resolution reads each segment as a literal key,
// so a hyphen is never arithmetic.
const TOKEN_SEGMENT = '[a-zA-Z_][a-zA-Z0-9_]*(?:-[a-zA-Z0-9_]+)*';
const TOKEN_PATH = `${TOKEN_SEGMENT}(?:\\??\\.${TOKEN_SEGMENT})*`;

// A well-formed token, for detection: `{{ path [?? default] [| filter]... }}`, whitespace anywhere. Deliberately
// strict: templates are user-written, so `{{var 1}}`, `{{var.1}}`, `{{ x | }}` and `{{}}` must read as malformed.
const TOKEN_BODY = `${TOKEN_PATH}(?:\\s*\\?\\?\\s*[^|{}]+?)?(?:\\s*\\|\\s*[a-zA-Z_]+(?:\\([^)]*\\))?)*`;
const TOKEN_DOUBLE = `\\{\\{\\s*${TOKEN_BODY}\\s*\\}\\}`;
const TOKEN_TRIPLE = `\\{\\{\\{\\s*${TOKEN_BODY}\\s*\\}\\}\\}`;
// Triple braces match first to avoid a partial match by the double-brace alternative.
const TOKEN_BASE = `(?:${TOKEN_TRIPLE}|${TOKEN_DOUBLE})`;

export const TOKEN_REGEX = new RegExp(TOKEN_BASE, 'g');
export const TOKEN_STRICT_REGEX = new RegExp(`^${TOKEN_BASE}$`);
