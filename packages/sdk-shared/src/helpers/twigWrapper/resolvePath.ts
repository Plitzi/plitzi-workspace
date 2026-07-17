// Reads a dotted path out of the context, treating every segment as a literal key. A missing or non-object link
// in the chain yields undefined rather than throwing, so a mistyped path degrades quietly.
export const resolvePath = (context: Record<string, unknown>, path: string): unknown => {
  let current: unknown = context;
  for (const segment of path.split(/\??\./)) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
};
