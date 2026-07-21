import { evalOperand } from '../expressions/evalOperand';
import { resolvePath } from '../expressions/resolvePath';
import { applyFilters, isRawMarker, unwrapRaw } from '../filters/filters';
import { TOKEN_INNER, TOKEN_MATCH } from '../patterns/patterns';

const CYCLE_ARRAY = /^\[(.*)\]$/;

// Finds the index of the matching `)` for a function call starting at `openIdx`, accounting for nested parens and
// quoted strings (which may contain parens/commas). Returns the index of the matching `)` or -1 if not found.
const findFuncEnd = (s: string, openIdx: number): number => {
  let depth = 0;
  let inQuote: string | null = null;
  for (let i = openIdx; i < s.length; i++) {
    const c = s[i];
    if (inQuote) {
      if (c === inQuote) {
        inQuote = null;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      inQuote = c;
      continue;
    }
    if (c === '(') {
      depth++;
    } else if (c === ')') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
};

// Splits `max(items) | upper` into `["max(items)", "| upper"]` — or `[trimmed, ""]` if no trailing filter.
// The funcStart is the index of `(`. We find the matching `)` and slice the rest.
const splitFuncAndFilters = (trimmed: string, funcStart: number): [string, string] => {
  const endIdx = findFuncEnd(trimmed, funcStart);
  if (endIdx === -1) {
    return [trimmed, ''];
  }
  const funcCall = trimmed.slice(0, endIdx + 1).trim();
  const filters = trimmed.slice(endIdx + 1).trim();
  return [funcCall, filters];
};

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

// Evaluates `range(end)`, `range(start, end)` or `range(start, end, step)` and returns an array of numbers.
// In Twig, `range(5)` returns [0, 1, 2, 3, 4, 5] (start defaults to 0).
const evalRange = (args: string, context: Record<string, unknown>): unknown => {
  const parts = splitFuncArgs(args).map(a => Number(evalOperand(a.trim(), context)));
  if (parts.length === 0) {
    return null;
  }

  // Twig: range(end) → range(0, end)
  const start = parts.length === 1 ? 0 : parts[0];
  const end = parts.length === 1 ? parts[0] : parts[1];
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

// Finds the index of the first top-level `|` pipe character in a string, skipping pipes inside
// quoted strings and parentheses. Returns -1 if no top-level pipe is found.
const findTopLevelPipe = (s: string): number => {
  let inQuote: string | null = null;
  let parenDepth = 0;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];

    if (inQuote) {
      if (c === inQuote) {
        inQuote = null;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      inQuote = c;
      continue;
    }
    if (c === '(') {
      parenDepth++;
      continue;
    }
    if (c === ')') {
      parenDepth--;
      continue;
    }
    if (c === '|' && parenDepth === 0) {
      return i;
    }
  }
  return -1;
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
        const openParenIdx = trimmed.indexOf('(');

        // Detect `funcName(` at the start — must start with a letter/underscore.
        if (openParenIdx !== -1 && /^[a-zA-Z_]\w*\s*\(/.test(trimmed)) {
          const funcName = trimmed.slice(0, openParenIdx).trim();
          const [funcCall, filtersStr] = splitFuncAndFilters(trimmed, openParenIdx);
          const args = funcCall.slice(funcName.length + 1, -1);

          // Guard: empty args → treat as invalid (e.g. `max()` should leave the token as-is).
          if (!args.trim()) {
            return full;
          }

          let result: unknown = null;
          if (funcName === 'cycle') {
            result = evalCycle(args, context);
          } else if (funcName === 'max') {
            result = evalMax(args, context);
          } else if (funcName === 'min') {
            result = evalMin(args, context);
          } else if (funcName === 'range') {
            result = evalRange(args, context);
          }

          if (result !== null && result !== undefined) {
            const filtered = applyFilters(result, filtersStr, context);

            if (isRawMarker(filtered)) {
              return stringify(unwrapRaw(filtered));
            }

            if (isTriple) {
              return stringify(filtered);
            }

            if (typeof filtered === 'object' && filtered !== null) {
              return JSON.stringify(filtered);
            }

            return stringify(filtered);
          }
        }

        // Tilde concatenation: `{{ a ~ " and " ~ b }}` — the `~` operator concatenates strings.
        // evalOperand handles `~` natively, so we split off any trailing filter chain and pass the
        // expression through evalOperand.
        if (trimmed.includes('~')) {
          const pipeIdx = findTopLevelPipe(trimmed);
          const expr = pipeIdx === -1 ? trimmed : trimmed.slice(0, pipeIdx).trim();
          const filtersPart = pipeIdx === -1 ? '' : trimmed.slice(pipeIdx);

          const result = evalOperand(expr, context);
          if (result !== undefined) {
            const filtered = applyFilters(result, filtersPart, context);

            if (isRawMarker(filtered)) {
              return stringify(unwrapRaw(filtered));
            }

            if (isTriple) {
              return stringify(filtered);
            }

            if (typeof filtered === 'object' && filtered !== null) {
              return JSON.stringify(filtered);
            }

            return stringify(filtered);
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
