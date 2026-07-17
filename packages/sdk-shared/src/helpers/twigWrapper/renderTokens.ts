import { evalOperand } from './evalOperand';
import { applyFilters } from './filters';
import { TOKEN_INNER, TOKEN_MATCH } from './patterns';
import { resolvePath } from './resolvePath';

// Missing values render empty; everything else uses its string form, so `false`, `0` and an object read exactly
// as twig produced them (`'false'`, `'0'`, `'[object Object]'`).
const stringify = (value: unknown): string => {
  if (value === undefined || value === null) {
    return '';
  }

  // Intentional: an object reads as '[object Object]', the exact output the previous twig-backed path produced.
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(value);
};

// Replaces every `{{ ... }}` occurrence with its resolved value. A `{{ ... }}` whose contents are not a valid token
// (a JS object literal, a typo) is left exactly as written.
export const renderTokens = (
  template: string,
  context: Record<string, unknown>,
  keepEmptyTokens: boolean,
  asRaw: boolean
): string =>
  template.replace(TOKEN_MATCH, (full: string, innerRaw: string) => {
    const inner = TOKEN_INNER.exec(innerRaw);
    if (!inner) {
      return full;
    }

    const path = inner[1];
    const filtersStr = inner[3];
    // The `?? default` group is optional at runtime, though the RegExp typing claims every group is a string.
    const defaultExpr = inner[2] as string | undefined;

    // keepEmptyTokens keeps the original token on a miss or an empty string, and ignores `??`/filters — matching
    // the previous behaviour where only the bare path was resolved.
    if (keepEmptyTokens) {
      const resolved = resolvePath(context, path);

      return resolved === undefined || resolved === null || resolved === '' ? full : stringify(resolved);
    }

    let value = resolvePath(context, path);
    if (defaultExpr !== undefined && (value === undefined || value === null)) {
      value = evalOperand(defaultExpr, context);
    }

    value = applyFilters(value, filtersStr, context);

    // asRaw serialises an object so the whole result can be JSON.parsed back into typed data.
    if (asRaw && typeof value === 'object' && value !== null) {
      value = JSON.stringify(value);
    }

    return stringify(value);
  });
