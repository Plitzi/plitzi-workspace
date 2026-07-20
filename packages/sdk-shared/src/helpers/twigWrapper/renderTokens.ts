import { evalOperand } from './evalOperand';
import { applyFilters, isRawMarker, unwrapRaw } from './filters';
import { TOKEN_INNER, TOKEN_MATCH } from './patterns';
import { resolvePath } from './resolvePath';

// Matches `cycle(values, position)` — the Twig cycle function. The first argument can be an array literal
// (`['odd', 'even']` or `["odd", "even"]`) or a variable path; the second is any expression (variable, number).
const CYCLE_CALL = /^cycle\((.+)\)$/;
const CYCLE_ARRAY = /^\[(.+)\]$/;

// Finds the comma that separates the two `cycle()` arguments, skipping commas inside brackets so
// `cycle(['a, b'], 0)` splits correctly at the outer comma.
const findCycleSplitIndex = (args: string): number => {
  let depth = 0;
  for (let i = args.length - 1; i >= 0; i--) {
    if (args[i] === ']') {
      depth++;
    }
    if (args[i] === '[') {
      depth--;
    }
    if (args[i] === ',' && depth === 0) {
      return i;
    }
  }
  return -1;
};

// Evaluates `cycle(values, position)` and returns the cycled value, or null if the call is invalid.
const evalCycle = (args: string, context: Record<string, unknown>): unknown => {
  const splitIdx = findCycleSplitIndex(args);
  if (splitIdx === -1) {
    return null;
  }

  const valuesArg = args.slice(0, splitIdx).trim();
  const positionArg = args.slice(splitIdx + 1).trim();

  // Parse the values: array literal or variable path
  let values: unknown[];
  const arrayMatch = CYCLE_ARRAY.exec(valuesArg);
  if (arrayMatch) {
    values = arrayMatch[1].split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
  } else {
    const resolved = evalOperand(valuesArg, context);
    values = Array.isArray(resolved) ? resolved : [];
  }

  if (values.length === 0) {
    return null;
  }

  const position = Number(evalOperand(positionArg, context));
  if (Number.isNaN(position)) {
    return null;
  }

  return values[((position % values.length) + values.length) % values.length];
};

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

// Replaces every `{{ ... }}` or `{{{ ... }}}` occurrence with its resolved value. Triple braces render the raw
// toString form (`[object Object]` for objects); double braces JSON-serialise objects so the result can be
// round-tripped. A `{{ ... }}` whose contents are not a valid token is left exactly as written.
export const renderTokens = (
  template: string,
  context: Record<string, unknown>,
  keepEmptyTokens: boolean,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _asRaw: boolean
): string =>
  template.replace(
    TOKEN_MATCH,
    (full: string, tripleContent: string | undefined, doubleContent: string | undefined) => {
      const isTriple = tripleContent !== undefined;
      const innerRaw = isTriple ? tripleContent : doubleContent;

      if (innerRaw === undefined) {
        return full;
      }

      const inner = TOKEN_INNER.exec(innerRaw);
      if (!inner) {
        // Try Twig `cycle(values, position)` function call before giving up.
        const cycleMatch = CYCLE_CALL.exec(innerRaw.trim());
        if (cycleMatch) {
          const cycled = evalCycle(cycleMatch[1], context);
          if (cycled !== null) {
            return stringify(cycled);
          }
        }
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

      // `| raw` marks the value to bypass JSON serialization.
      if (isRawMarker(value)) {
        return stringify(unwrapRaw(value));
      }

      // Triple braces: always raw toString (objects → `[object Object]`).
      if (isTriple) {
        return stringify(value);
      }

      // Double braces: objects are JSON-serialised so the result can be round-tripped; primitives use their string form.
      if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value);
      }

      return stringify(value);
    }
  );
