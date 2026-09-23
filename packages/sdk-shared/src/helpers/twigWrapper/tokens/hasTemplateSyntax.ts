/**
 * Whether a string is written in template syntax at all — any `{{ … }}` or `{% … %}`, well-formed token or not.
 *
 * `hasValidToken` answers a narrower question on purpose: whether an ATTRIBUTE holds a token worth resolving, where
 * the text around it is often prose and a stray `{{` must not be evaluated. A step's params are the other case: they
 * are templates by construction, so a condition (`{{ admin ? '1' : '' }}`) or a loop (`{% for %}…{% endfor %}`) is
 * meant to run — read by the narrow test they were handed on as written, and a flag stored its own template text.
 */
export const hasTemplateSyntax = (value: unknown): value is string =>
  typeof value === 'string' && /\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/.test(value);
