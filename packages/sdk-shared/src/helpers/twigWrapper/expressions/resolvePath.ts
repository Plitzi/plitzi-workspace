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

// Reads a dotted path out of the context, treating every segment as a literal key. A missing or non-object link
// in the chain yields undefined rather than throwing, so a mistyped path degrades quietly.
export const resolvePath = (context: Record<string, unknown>, path: string): unknown => {
  // Fast path: single-segment path — avoid regex split + loop.
  if (isSimplePath(path)) {
    const val = context[path];
    return val === undefined ? undefined : val;
  }

  let current: unknown = context;
  for (const segment of path.split(/\??\./)) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
};
