import { resolveTokens } from './TemplateCache';

const collectRoots = (value: unknown, names: Set<string>): void => {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectRoots(item, names);
    }

    return;
  }

  if (typeof value !== 'object' || value === null) {
    return;
  }

  if ('type' in value && value.type === 'path' && 'segments' in value && Array.isArray(value.segments)) {
    const root: unknown = value.segments[0];
    if (typeof root === 'string') {
      names.add(root);
    }

    return;
  }

  for (const child of Object.values(value)) {
    collectRoots(child, names);
  }
};

/**
 * Every top-level name a template reads: `{{ theme.resolved }}` and `{% if state.open %}` both give their first segment.
 *
 * Read off the parsed template rather than matched with a pattern, so a name inside a filter argument, a ternary or a
 * loop's collection counts, and one inside a string literal does not. Names the template binds itself — a loop
 * variable, a `set` — come back too: they resolve to no source, and asking for a name that is not there costs nothing.
 */
export const templateRootNames = (template: string): string[] => {
  const entry = resolveTokens(template);
  if (!entry) {
    return [];
  }

  const names = new Set<string>();
  collectRoots(entry.nodes ?? entry.nodesWithSource, names);

  return [...names];
};
