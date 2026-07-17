import { TOKEN_REGEX, TOKEN_STRICT_REGEX } from './patterns';

// Whether a user-written string carries a well-formed token. Non-strict searches anywhere in the text (a token
// mixed with prose); strict requires the whole string to be exactly one token — the builder uses it to decide
// whether a field is in binding mode. A malformed `{{ ... }}` reads as false, so callers never try to resolve it.
export const hasValidToken = (value?: string, strict = false): boolean => {
  if (typeof value !== 'string') {
    return false;
  }

  const source = strict ? TOKEN_STRICT_REGEX : TOKEN_REGEX;
  source.lastIndex = 0;

  return source.test(value.trim());
};
