import { evalOperand } from '../expressions/evalOperand';
import { resolvePath } from '../expressions/resolvePath';
import { applyFilters, isRawMarker, unwrapRaw } from '../filters/filters';
import { TOKEN_INNER, TOKEN_MATCH } from '../patterns/patterns';

// Matches `cycle(values, position)` — the Twig cycle function. The first argument can be an array literal
// (`['odd', 'even']` or `["odd", "even"]`) or a variable path; the second is any expression (variable, number).
const CYCLE_CALL = /^cycle\((.+)\)$/;
const CYCLE_ARRAY = /^\[(.*)\]$/;

// Matches `max(a, b, ...)` and `min(a, b, ...)` — Twig max/min functions.
const MAX_CALL = /^max\((.+)\)$/;
const MIN_CALL = /^min\((.+)\)$/;

// Matches `range(start, end)` or `range(start, end, step)` — Twig range function.
const RANGE_CALL = /^range\((.+)\)$/;

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
    values = arrayMatch[1] === '' ? [] : arrayMatch[1].split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
  } else {
    const resolved = evalOperand(valuesArg, context);
    values = Array.isArray(resolved) ? resolved : [];
  }

  if (values.length === 0) {
    return '';
  }

  const position = Number(evalOperand(positionArg, context));
  if (Number.isNaN(position)) {
    return null;
  }

  return values[((position % values.length) + values.length) % values.length];
};

// Evaluates `max(a, b, ...)` or `max(array)` and returns the maximum value.
// When a single argument resolves to an array, it is flattened so max([1,2,3]) === max(1,2,3).
const evalMax = (args: string, context: Record<string, unknown>): unknown => {
  const resolved = splitFuncArgs(args).map(a => evalOperand(a.trim(), context));
  if (resolved.length === 0) {
    return null;
  }
  const values = resolved.flat(1);
  const nums = values.map(Number).filter(n => !Number.isNaN(n));
  if (nums.length === values.length) {
    return Math.max(...nums);
  }
  const strs = values.map(String);
  return strs.sort().at(-1) ?? null;
};

// Evaluates `min(a, b, ...)` or `min(array)` and returns the minimum value.
// When a single argument resolves to an array, it is flattened so min([1,2,3]) === min(1,2,3).
const evalMin = (args: string, context: Record<string, unknown>): unknown => {
  const resolved = splitFuncArgs(args).map(a => evalOperand(a.trim(), context));
  if (resolved.length === 0) {
    return null;
  }
  const values = resolved.flat(1);
  const nums = values.map(Number).filter(n => !Number.isNaN(n));
  if (nums.length === values.length) {
    return Math.min(...nums);
  }
  const strs = values.map(String);
  return strs.sort().at(0) ?? null;
};

// Evaluates `range(start, end)` or `range(start, end, step)` and returns an array of numbers.
const evalRange = (args: string, context: Record<string, unknown>): unknown => {
  const parts = splitFuncArgs(args).map(a => Number(evalOperand(a.trim(), context)));
  if (parts.length < 2) {
    return null;
  }

  const start = parts[0];
  const end = parts[1];
  const hasExplicitStep = parts.length >= 3;
  const step = hasExplicitStep ? parts[2] : (start <= end ? 1 : -1);

  if (step === 0) {
    return [];
  }

  const result: number[] = [];
  if (step > 0) {
    for (let i = start; i <= end; i += step) {
      result.push(i);
    }
  } else {
    for (let i = start; i >= end; i += step) {
      result.push(i);
    }
  }

  return result;
};

// Splits comma-separated function arguments while respecting quoted strings and brackets.
const splitFuncArgs = (args: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inQuote: string | null = null;

  for (const char of args) {
    if (inQuote) {
      current += char;
      if (char === inQuote) {
        inQuote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      inQuote = char;
      current += char;
      continue;
    }
    if (char === '(' || char === '[') {
      depth++;
      current += char;
      continue;
    }
    if (char === ')' || char === ']') {
      depth--;
      current += char;
      continue;
    }
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  parts.push(current);
  return parts;
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
        // Try Twig function calls before giving up.
        const trimmed = innerRaw.trim();

        const cycleMatch = CYCLE_CALL.exec(trimmed);
        if (cycleMatch) {
          const cycled = evalCycle(cycleMatch[1], context);
          if (cycled !== null) {
            return stringify(cycled);
          }
        }

        const maxMatch = MAX_CALL.exec(trimmed);
        if (maxMatch) {
          const maxVal = evalMax(maxMatch[1], context);
          if (maxVal !== null) {
            return stringify(maxVal);
          }
        }

        const minMatch = MIN_CALL.exec(trimmed);
        if (minMatch) {
          const minVal = evalMin(minMatch[1], context);
          if (minVal !== null) {
            return stringify(minVal);
          }
        }

        const rangeMatch = RANGE_CALL.exec(trimmed);
        if (rangeMatch) {
          const rangeVal = evalRange(rangeMatch[1], context);
          if (rangeVal !== null) {
            return isTriple ? stringify(rangeVal) : JSON.stringify(rangeVal);
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
        const resolved = evalOperand(path, context);

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
