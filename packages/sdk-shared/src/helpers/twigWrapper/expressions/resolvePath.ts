// Fast-path check: returns true when the path has no dots, so a single `context[path]` lookup suffices.
const isSimplePath = (path: string): boolean => {
  const len = path.length;
  for (let i = 0; i < len; i++) {
    if (path[i] === '.') {
      return false;
    }
  }
  return true;
};

// Splits a dotted path into segments, handling optional `?` before dots (e.g. `foo?.bar` → `['foo', 'bar']`).
const splitPath = (path: string): string[] => {
  const segments: string[] = [];
  let start = 0;
  const len = path.length;

  for (let i = 0; i < len; i++) {
    const c = path.charCodeAt(i);
    if (c === 46) {
      // .
      segments.push(path.slice(start, i));
      start = i + 1;
    }
  }

  segments.push(path.slice(start));
  return segments;
};

// Reads a dotted path out of the context, treating every segment as a literal key. A missing or non-object link
// in the chain yields undefined rather than throwing, so a mistyped path degrades quietly.
export const resolvePath = (context: Record<string, unknown>, path: string): unknown => {
  // Fast path: single-segment path — avoid split + loop.
  if (isSimplePath(path)) {
    const val = context[path];
    return val === undefined ? undefined : val;
  }

  let current: unknown = context;
  for (const segment of splitPath(path)) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }

    // Skip optional chain markers (e.g. `foo?.bar` → segment is `foo?`).
    const key = segment.endsWith('?') ? segment.slice(0, -1) : segment;
    current = (current as Record<string, unknown>)[key];
  }

  return current;
};
