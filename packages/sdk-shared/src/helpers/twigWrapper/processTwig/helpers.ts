import type { CacheEntry } from '../TemplateCache';

export const resolveSimplePath = (context: Record<string, unknown>, name: string): unknown => context[name];

// Reads a dotted path (`a.b.c`) out of the context, treating every segment as a literal key. A missing or
// non-object link yields undefined rather than throwing.
export const resolveDottedPath = (context: Record<string, unknown>, path: string): unknown => {
  const firstDot = path.indexOf('.');
  if (firstDot === -1) {
    return context[path];
  }

  let current: unknown = context[path.slice(0, firstDot)];
  let start = firstDot + 1;
  const len = path.length;

  while (start < len) {
    if (current === null || current === undefined) {
      return undefined;
    }
    const nextDot = path.indexOf('.', start);
    if (nextDot === -1) {
      return (current as Record<string, unknown>)[path.slice(start)];
    }
    current = (current as Record<string, unknown>)[path.slice(start, nextDot)];
    start = nextDot + 1;
  }

  return current;
};

// Serialises a resolved value for `{{ }}` output: nullish → '', object → JSON, everything else → String().
export const serializeValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(value);
};

// When asRaw is requested, a JSON-shaped output is parsed back into typed data; anything else passes through.
export const finalizeRaw = (output: string): unknown => {
  try {
    const parsed = JSON.parse(output) as string | object;
    return parsed || output;
  } catch {
    return output;
  }
};

// Merges a `{ variables: {...} }` wrapper down into a flat context, with root keys taking precedence.
export const flattenContext = (variables: Record<string, unknown>): Record<string, unknown> => {
  const flattened: Record<string, unknown> = {};
  const inner = variables.variables as Record<string, unknown>;
  for (const key in inner) {
    flattened[key] = inner[key];
  }
  for (const key in variables) {
    flattened[key] = variables[key];
  }

  return flattened;
};

// Renders a template whose tokens are all simple/dotted paths (no tags, no filters) straight from the cache
// entry, skipping the AST evaluator entirely — the common interpolation case.
export const renderSimpleTokens = (entry: CacheEntry, context: Record<string, unknown>): string => {
  let output = '';
  for (const token of entry.tokens) {
    if (token.type === 'text') {
      output += token.value;
    } else if (token.type === 'variable') {
      const trimmed = token.content.trim();
      const value =
        token.content.indexOf('.') === -1 ? resolveSimplePath(context, trimmed) : resolveDottedPath(context, trimmed);
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      output += token.raw ? (value === null || value === undefined ? '' : String(value)) : serializeValue(value);
    }
  }

  return output;
};
