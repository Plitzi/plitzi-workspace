import { resolveTokens } from './TemplateCache';

/** Every static path a parsed template reads — `computed.tool`, `state.owned` — as the segments it names. */
const collectPaths = (value: unknown, paths: Set<string>): void => {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectPaths(item, paths);
    }

    return;
  }

  if (typeof value !== 'object' || value === null) {
    return;
  }

  if ('type' in value && value.type === 'path' && 'segments' in value && Array.isArray(value.segments)) {
    const segments = value.segments.filter((segment): segment is string => typeof segment === 'string');
    if (segments.length > 0) {
      paths.add(segments.join('.'));
    }

    return;
  }

  for (const child of Object.values(value)) {
    collectPaths(child, paths);
  }
};

/**
 * Every path a template reads, as far as it is known before it runs: `{{ computed.tool == 'pen' }}` gives
 * `computed.tool`, `{{ state.owned[source.id] }}` gives `state.owned` and `source.id` — a bracket whose key is only
 * known at run time ends the path at what came before it.
 *
 * What a caller SUBSCRIBES to, where the root alone would be too much: an element whose template reads
 * `computed.tool` has no reason to render again when `computed.selectionCount` changes, and every element on a page
 * reads some computed value. Names the template binds itself — a loop variable, a `set`, an arrow's parameter —
 * come back too: they resolve to no source, and asking for a path that is not there costs nothing.
 */
const PATHS_LIMIT = 5000;
const pathsOf = new Map<string, readonly string[]>();

/**
 * The paths a template reads, read once per template: every element asks it of its own on every render — the
 * server's and the browser's — and the same few hundred templates walked their syntax tree again each time.
 */
export const templatePaths = (template: string): readonly string[] => {
  const known = pathsOf.get(template);
  if (known) {
    return known;
  }

  const entry = resolveTokens(template);
  const paths = new Set<string>();
  if (entry) {
    collectPaths(entry.nodes ?? entry.nodesWithSource, paths);
  }

  const found = [...paths];
  pathsOf.set(template, found);
  if (pathsOf.size > PATHS_LIMIT) {
    const [oldest] = pathsOf.keys();
    pathsOf.delete(oldest);
  }

  return found;
};

/**
 * Every top-level name a template reads: `{{ theme.resolved }}` and `{% if state.open %}` both give their first segment.
 *
 * Read off the parsed template rather than matched with a pattern, so a name inside a filter argument, a ternary or a
 * loop's collection counts, and one inside a string literal does not. Names the template binds itself — a loop
 * variable, a `set` — come back too: they resolve to no source, and asking for a name that is not there costs nothing.
 */
export const templateRootNames = (template: string): string[] => [
  ...new Set(templatePaths(template).map(path => path.split('.')[0]))
];
