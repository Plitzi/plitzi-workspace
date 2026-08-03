import type { Element } from '@plitzi/sdk-shared';

/** Structural keys a page needs regardless of what it binds, so paging never depends on static analysis. */
const ALWAYS_KEPT = ['pageInfo'];

type PathTrie = { leaf: boolean; children: Map<string, PathTrie> };

const createNode = (): PathTrie => ({ leaf: false, children: new Map() });

const insert = (root: PathTrie, segments: string[]) => {
  let node = root;
  for (const segment of segments) {
    // A numeric segment is an index the author happened to bind (`records.0.title`); the shape it describes applies
    // to every item, so it collapses into a wildcard rather than pinning the projection to one row.
    const key = /^\d+$/.test(segment) ? '*' : segment;
    let next = node.children.get(key);
    if (!next) {
      next = createNode();
      node.children.set(key, next);
    }

    node = next;
  }

  node.leaf = true;
};

/** Pulls `<source>.<path>` references out of any string that may carry a twig token. */
const collectFromTemplate = (value: unknown, sourceName: string, found: Set<string>) => {
  if (typeof value !== 'string') {
    return;
  }

  const pattern = new RegExp(`${sourceName}\\.([a-zA-Z0-9_\\-.]+)`, 'g');
  for (const match of value.matchAll(pattern)) {
    found.add(match[1].replace(/\.$/, ''));
  }
};

const walkUnknown = (value: unknown, sourceName: string, found: Set<string>) => {
  if (typeof value === 'string') {
    collectFromTemplate(value, sourceName, found);

    return;
  }

  if (Array.isArray(value)) {
    value.forEach(entry => walkUnknown(entry, sourceName, found));

    return;
  }

  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(entry => walkUnknown(entry, sourceName, found));
  }
};

/**
 * Collects the paths a page actually reads out of one provider source.
 *
 * Bindings declare `<source>.<path>` directly; transformer params, `when` rules and attribute templates can carry
 * the same reference inside a twig token, so both are scanned. Returning an empty set means nothing statically
 * references the source — the caller must then keep the slice whole rather than serve an empty one.
 */
export const collectBoundPaths = (flat: Record<string, Element>, rootId: string, sourceName: string): string[] => {
  if (!sourceName) {
    return [];
  }

  const found = new Set<string>();
  const seen = new Set<string>();
  const pending = [rootId];
  const prefix = `${sourceName}.`;
  while (pending.length > 0) {
    const id = pending.pop();
    if (id === undefined || seen.has(id)) {
      continue;
    }

    seen.add(id);
    const element = flat[id] as Element | undefined;
    if (!element) {
      continue;
    }

    const { bindings, items } = element.definition;
    Object.values(bindings ?? {}).forEach(categoryBindings => {
      categoryBindings.forEach(binding => {
        if (binding.source.startsWith(prefix)) {
          found.add(binding.source.slice(prefix.length));
        }

        walkUnknown(binding.transformers, sourceName, found);
        walkUnknown(binding.when, sourceName, found);
      });
    });
    walkUnknown(element.attributes, sourceName, found);
    if (items) {
      pending.push(...items);
    }
  }

  return [...found];
};

const projectNode = (value: unknown, node: PathTrie): unknown => {
  if (node.leaf || node.children.size === 0) {
    return value;
  }

  if (Array.isArray(value)) {
    const itemNode = node.children.get('*');

    return value.map(item => projectNode(item, itemNode ?? node));
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  const source = value as Record<string, unknown>;

  return [...node.children.entries()].reduce<Record<string, unknown>>((acum, [key, child]) => {
    if (key !== '*' && key in source) {
      acum[key] = projectNode(source[key], child);
    }

    return acum;
  }, {});
};

/**
 * Narrows a provider slice to what the page reads.
 *
 * A CMS entry routinely carries fields nobody bound — author emails, internal notes, unpublished translations.
 * Those would otherwise land in the client store and in the HTML, so anything unreferenced is dropped here. With no
 * declared paths the slice passes through untouched: an empty projection would blank the page, and shipping too
 * much is a smaller failure than rendering nothing.
 */
export const projectSlice = (slice: unknown, paths: string[]): unknown => {
  if (paths.length === 0 || slice === null || typeof slice !== 'object') {
    return slice;
  }

  const root = createNode();
  paths.forEach(path => insert(root, path.split('.')));
  ALWAYS_KEPT.forEach(key => insert(root, [key]));

  return projectNode(slice, root);
};
