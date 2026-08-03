/** Elements that execute, navigate or embed something the page never asked for. Dropped with their contents. */
const FORBIDDEN_TAGS = /<\s*(script|style|iframe|object|embed|link|meta|base|form)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;

/** The same tags in self-closing or unterminated form, which a truncated CMS field routinely produces. */
const FORBIDDEN_VOID_TAGS = /<\s*\/?\s*(script|style|iframe|object|embed|link|meta|base|form)\b[^>]*>/gi;

/** Any `on*` handler, quoted or bare. */
const EVENT_HANDLERS = /\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

/** `javascript:` and `data:` targets in href/src, including entity- and whitespace-obfuscated spellings. */
const DANGEROUS_URLS =
  /\s(href|src|xlink:href)\s*=\s*(?:"\s*(?:javascript|data|vbscript)\s*:[^"]*"|'\s*(?:javascript|data|vbscript)\s*:[^']*'|(?:javascript|data|vbscript)\s*:[^\s>]*)/gi;

/**
 * Strips everything executable out of third-party HTML.
 *
 * This exists because `BlockHtml` deliberately does the opposite: it extracts `<script>` tags and runs them, which
 * is correct for an embed the site's own author pasted in and unacceptable for a body field that arrives from a
 * CMS — where the author of the content and the author of the site are, by design, different people.
 *
 * Deny-list sanitizing in a regex is not equivalent to parsing, and it is not claimed to be: it is the last line,
 * not the only one. The provider is trusted (the site owner connected it), the content is not, and the markup a
 * CMS body field produces is ordinary prose markup. `data:` is refused in URLs for the same reason as
 * `javascript:` — an `data:text/html` navigation is script by another name.
 */
export const sanitizeHtml = (html: string): string =>
  html
    .replace(FORBIDDEN_TAGS, '')
    .replace(FORBIDDEN_VOID_TAGS, '')
    .replace(EVENT_HANDLERS, '')
    .replace(DANGEROUS_URLS, '');

/**
 * Rewrites relative media paths in already-sanitized markup.
 *
 * A connector rebases the URLs it finds in a record's *fields*, but a body field is one opaque string — the
 * `<img src="/uploads/x.png">` inside it is invisible to that pass and has to be handled where the markup is
 * finally read.
 */
export const rebaseHtmlMedia = (html: string, baseUrl: string): string => {
  if (!baseUrl) {
    return html;
  }

  const base = baseUrl.replace(/\/+$/, '');

  return html.replace(/\s(src|href)\s*=\s*"(\/(?!\/)[^"]*)"/gi, (_match, attribute: string, path: string) => {
    return ` ${attribute}="${base}${path}"`;
  });
};
