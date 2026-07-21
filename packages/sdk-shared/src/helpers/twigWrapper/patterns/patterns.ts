// The regex grammar shared across the twigWrapper modules.

// A token segment allows internal hyphens (a source idRef is `<type>_<idIdRef>` and an idRef may carry them), but
// never a leading or trailing one — the segment starts on `[a-zA-Z_]` and every '-' is followed by more word
// chars. Resolution splits the path and reads each segment as a literal key, so a hyphen is never arithmetic.
const TOKEN_SEGMENT = '[a-zA-Z_][a-zA-Z0-9_]*(?:-[a-zA-Z0-9_]+)*';
const TOKEN_PATH = `${TOKEN_SEGMENT}(?:\\??\\.${TOKEN_SEGMENT})*`;

// A well-formed token, for detection: `{{ path [?? default] [| filter]... }}`, whitespace anywhere. Deliberately
// strict and kept in step with TOKEN_INNER — templates are user-written, so `{{var 1}}`, `{{var.1}}`, `{{ x | }}`
// and `{{}}` must read as malformed (not a token) exactly as renderTokens then declines to resolve them.
const TOKEN_BODY = `${TOKEN_PATH}(?:\\s*\\?\\?\\s*[^|{}]+?)?(?:\\s*\\|\\s*[a-zA-Z_]+(?:\\([^)]*\\))?)*`;
const TOKEN_DOUBLE = `\\{\\{\\s*${TOKEN_BODY}\\s*\\}\\}`;
const TOKEN_TRIPLE = `\\{\\{\\{\\s*${TOKEN_BODY}\\s*\\}\\}\\}`;
const TOKEN_BASE = `(?:${TOKEN_TRIPLE}|${TOKEN_DOUBLE})`;
export const TOKEN_REGEX = new RegExp(TOKEN_BASE, 'g');
export const TOKEN_STRICT_REGEX = new RegExp(`^${TOKEN_BASE}$`);

// A `{{ ... }}` or `{{{ ... }}}` occurrence, and the grammar of its contents: a path, an optional
// `?? default`, optional filters. Triple braces match first to avoid partial matches by the double-brace alternative.
export const TOKEN_MATCH = /\{\{\{([\s\S]*?)\}\}\}|\{\{([\s\S]*?)\}\}/g;
export const TOKEN_INNER = new RegExp(
  `^\\s*(${TOKEN_PATH})\\s*(?:\\?\\?\\s*([^|]+?)\\s*)?((?:\\|\\s*[a-zA-Z_]+(?:\\([^)]*\\))?\\s*)*)$`
);
export const FILTER_RE = /\|\s*([a-zA-Z0-9_]+)(?:\(([^)]*)\))?/g;

// A single well-formed `{% if %}` block, with optional `{% elseif %}` chains and `{% else %}`. The condition
// may not cross `%}`, and each body holds no structural tag (`if`/`else`/`elseif`/`endif`), so a match is always
// an innermost, correctly paired block — repeated replacement then resolves inner blocks before their parents. A
// block missing its `%}` or `{% endif %}`, or with an empty condition, simply never matches and is left in place
// rather than half-rendered.
const IF_BODY = '(?:(?!\\{%\\s*(?:if|else|elseif|endif)\\b)[\\s\\S])*?';
const ELSEIF_SECTION = `(?:\\{%\\s*elseif\\s+(?:(?!%\\})[\\s\\S])+?\\s*%\\}${IF_BODY})`;
export const IF_BLOCK = new RegExp(
  `\\{%\\s*if\\s+((?:(?!%\\})[\\s\\S])+?)\\s*%\\}(${IF_BODY})${ELSEIF_SECTION}*(?:\\{%\\s*else\\s*%\\}(${IF_BODY}))?\\{%\\s*endif\\s*%\\}`
);
export const COMPARISON = /^([\s\S]+?)\s*(==|!=|>=|<=|>|<)\s*([\s\S]+)$/;
export const STRING_LITERAL = /^(['"])([\s\S]*)\1$/;

// Matches the opening `{% for %}` tag with its variable(s) and collection expression. Captures the primary
// variable name, the optional secondary variable (for `{% for key, value in obj %}`), and the collection expression.
export const FOR_OPEN = /\{%\s*for\s+(\w+)(?:\s*,\s*(\w+))?\s+in\s+((?:(?!%\})[\s\S])+?)\s*%\}/;

// Matches structural tags inside a for block body (for scanning nesting depth). Captures the tag type
// (for/endfor/else/if/endif) so the caller can track depth. The `for` and `if` alternatives allow content
// after the keyword to handle opening tags like `{% for b in a %}` or `{% if active %}`.
export const FOR_TAG = /\{%\s*(if\b[\s\S]*?|endif|for\b[\s\S]*?|endfor|else)\s*%\}/g;

// Detects the Twig range operator `start..end` inside a `{% for %}` collection expression. The bounds can be
// numeric literals (`0..10`, `-2..2`), variable paths (`start..end`) or quoted characters (`'a'..'z'`).
export const RANGE_EXPR = /^(['"]?)(-?\w+)\1\s*\.\.\s*(['"]?)(-?\w+)\3$/;

// Twig loop control tags: `{% break %}` exits the loop entirely, `{% continue %}` skips the current iteration.
// Whitespace is fully flexible, matching Twig conventions.
export const BREAK_TAG = /\{%\s*break\s*%\}/;
export const CONTINUE_TAG = /\{%\s*continue\s*%\}/;

// `{% set variable = expression %}` — assigns a value to a variable. Captures the variable name and the expression.
export const SET_ASSIGN = /\{%\s*set\s+(\w+)\s*=\s*((?:(?!%\})[\s\S])+?)\s*%\}/g;

// `{% set variable %}...{% endset %}` — captures a block of text into a variable.
export const SET_BLOCK = /\{%\s*set\s+(\w+)\s*%\}([\s\S]*?)\{%\s*endset\s*%\}/g;

// `{% apply filter1|filter2|... %}...{% endapply %}` — applies filters to a block of content.
export const APPLY_TAG = /\{%\s*apply\s+((?:(?!%\})[\s\S])+?)\s*%\}([\s\S]*?)\{%\s*endapply\s*%\}/g;
