import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

/** An element as it is asked about — by the panel, by `window.__plitzi.element()` and through it `plitzi check`. */
export type ElementReport = {
  id: string;
  type?: string;
  /** The component whose tree holds it, when it is inside one rather than on a page or a layout. */
  inComponent?: string;
  /** The component it places, when it is an instance — and what it hands in is among its attributes. */
  instanceOf?: string;
  attributes?: Record<string, unknown>;
  /** What it reads: each binding's target, its source and, when it has one, its template. */
  bindings?: { category: string; to: string; source: string; template?: string }[];
  /** The element's own UI state — an open dropdown, a tab — as the runtime keeps it. */
  state?: unknown;
  /** How many copies are on the page: a list row's elements are one per row, a component's one per instance. */
  copies: number;
  visible: boolean;
  box?: { x: number; y: number; width: number; height: number };
};

/**
 * A value as JSON can carry it: functions left out, a cycle cut, depth bounded.
 *
 * Only a true cycle is cut — an object inside itself, on the path being read. One value reached twice is printed twice:
 * a list publishes the array its provider answered, and cutting the second sight of it read as the provider holding
 * nothing.
 */
export const plain = (value: unknown, depth = 0, path = new WeakSet<object>()): unknown => {
  if (typeof value === 'function') {
    return undefined;
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  if (path.has(value) || depth > 12) {
    return '[…]';
  }

  path.add(value);
  const copy: unknown = Array.isArray(value)
    ? value.map(item => plain(item, depth + 1, path))
    : Object.fromEntries(
        Object.entries(value)
          .map(([key, item]): [string, unknown] => [key, plain(item, depth + 1, path)])
          .filter(([, item]) => item !== undefined)
      );
  path.delete(value);

  return copy;
};

export const recordAt = (value: unknown, ...path: string[]): Record<string, unknown> => {
  let current = value;
  for (const key of path) {
    current = isRecord(current) ? current[key] : undefined;
  }

  return isRecord(current) ? current : {};
};

const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** An element's bindings in one list, from the categories the document keeps them under. */
const bindingsOf = (element: unknown): NonNullable<ElementReport['bindings']> =>
  Object.entries(recordAt(element, 'definition', 'bindings')).flatMap(([category, list]) =>
    listOf(list).flatMap(binding => {
      const { to, source, transformers } = recordAt(binding);
      const template = listOf(transformers)
        .map(transformer => recordAt(transformer, 'params').template)
        .find(value => typeof value === 'string');

      return typeof to === 'string' && typeof source === 'string'
        ? [{ category, to, source, ...(typeof template === 'string' ? { template } : {}) }]
        : [];
    })
  );

/** The element by its id in whichever tree holds it — the pages', or one component's — and that component. */
const findElement = (schema: Record<string, unknown>, id: string): { element?: unknown; inComponent?: string } => {
  const flat = recordAt(schema, 'flat');
  if (Object.hasOwn(flat, id)) {
    return { element: flat[id] };
  }

  for (const [componentId, component] of Object.entries(recordAt(schema, 'components'))) {
    const tree = recordAt(component, 'flat');
    if (Object.hasOwn(tree, id)) {
      return { element: tree[id], inComponent: componentId };
    }
  }

  return {};
};

/**
 * What an element is and how it is doing, read from the root store's state and the page: its type and attributes, what
 * it binds to, its own state, and where it is on screen. Undefined for an id neither the document nor the page knows.
 */
export const elementReport = (state: unknown, id: string, document: Document): ElementReport | undefined => {
  const { element, inComponent } = findElement(recordAt(state, 'schema'), id);
  const nodes = Array.from(document.querySelectorAll(`[data-id="${id}"]`));
  if (!isRecord(element) && nodes.length === 0) {
    return undefined;
  }

  const node = nodes.at(0);
  const rect = node?.getBoundingClientRect();
  const style = node ? getComputedStyle(node) : undefined;
  const visible =
    rect !== undefined &&
    rect.width > 0 &&
    rect.height > 0 &&
    style?.display !== 'none' &&
    style?.visibility !== 'hidden';
  const type = recordAt(element, 'definition').type;
  const attributes = recordAt(element, 'attributes');
  const instanceOf =
    type === 'reference' && attributes.referenceType === 'component' && typeof attributes.referenceId === 'string'
      ? attributes.referenceId
      : undefined;
  const ownState = recordAt(state, 'runtime', 'elements')[id];

  return {
    id,
    ...(typeof type === 'string' ? { type } : {}),
    ...(inComponent === undefined ? {} : { inComponent }),
    ...(instanceOf === undefined ? {} : { instanceOf }),
    ...(isRecord(element) ? { attributes: recordAt(plain(element), 'attributes'), bindings: bindingsOf(element) } : {}),
    ...(ownState === undefined ? {} : { state: plain(ownState) }),
    copies: nodes.length,
    visible,
    ...(rect
      ? {
          box: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }
        }
      : {})
  };
};
