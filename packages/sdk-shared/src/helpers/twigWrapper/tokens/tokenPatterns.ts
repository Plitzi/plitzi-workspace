// Detection grammar for `hasValidToken`. A token segment allows internal hyphens (a source is `<type>_<id>` and
// an element name may carry them), but never a leading or trailing one — the segment starts on
// `[a-zA-Z_]` and every '-' is followed by more word chars. Resolution reads each segment as a literal key,
// so a hyphen is never arithmetic.
const TOKEN_NAME = '[a-zA-Z_][a-zA-Z0-9_]*(?:-[a-zA-Z0-9_]+)*';

// An element of a collection is addressed like any other key — `records.0.title` — so a segment after the first
// may be a bare index. The FIRST may not: `1.5` is a number, and reading it as a path would make one out of it.
const TOKEN_SEGMENT = `(?:${TOKEN_NAME}|\\d+)`;

// The bracket spelling of the same access: `records[0]`, `record["title"]`, `records[input.index]`. The subscript
// is a literal or a path rather than any expression — this grammar decides whether a string IS a token, and the
// arithmetic forms (`rows[page - 1]`) are left to the parser, which is the thing that can actually read them.
const TOKEN_INDEX = `\\[\\s*(?:\\d+|'[^']*'|"[^"]*"|${TOKEN_NAME}(?:\\.${TOKEN_SEGMENT})*)\\s*\\]`;
const TOKEN_PATH = `${TOKEN_NAME}(?:${TOKEN_INDEX})*(?:\\??\\.${TOKEN_SEGMENT}(?:${TOKEN_INDEX})*)*`;

// A well-formed token, for detection: `{{ path [?? default] [| filter]... }}`, whitespace anywhere. Deliberately
// strict: templates are user-written, so `{{var 1}}`, `{{ x | }}` and `{{}}` must read as malformed.
const TOKEN_BODY = `${TOKEN_PATH}(?:\\s*\\?\\?\\s*[^|{}]+?)?(?:\\s*\\|\\s*[a-zA-Z_]+(?:\\([^)]*\\))?)*`;
const TOKEN_DOUBLE = `\\{\\{\\s*${TOKEN_BODY}\\s*\\}\\}`;
const TOKEN_TRIPLE = `\\{\\{\\{\\s*${TOKEN_BODY}\\s*\\}\\}\\}`;
// Triple braces match first to avoid a partial match by the double-brace alternative.
const TOKEN_BASE = `(?:${TOKEN_TRIPLE}|${TOKEN_DOUBLE})`;

export const TOKEN_REGEX = new RegExp(TOKEN_BASE, 'g');
export const TOKEN_STRICT_REGEX = new RegExp(`^${TOKEN_BASE}$`);
