import { canonicalJson } from '@plitzi/sdk-shared/helpers/canonicalJson';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import type { Space } from '../../helpers';
import type { Element } from '@plitzi/sdk-shared';

/**
 * What a write did to the space, read off the documents before and after it — never off what was asked. An agent
 * that is told only what it asked for cannot see the element a shared class also restyled, the child a move took with
 * it, or the operation that changed nothing; every one of those is a line here. Past `LIMIT` lines the rest is
 * counted, never dropped unsaid.
 */

const LIMIT = 40;
const SHOWN = 60;

const same = (before: unknown, after: unknown): boolean => canonicalJson(before) === canonicalJson(after);

const shown = (value: unknown): string => {
  const text = canonicalJson(value);

  return text.length > SHOWN ? `${text.slice(0, SHOWN - 1)}…` : text;
};

/** Each entry of a list by what names it — its `id`, or its `name` — when every entry has one. */
const keyedList = (list: unknown[]): Map<string, unknown> | undefined => {
  const keyed = new Map<string, unknown>();
  for (const entry of list) {
    const key = isRecord(entry) ? (entry.id ?? entry.name) : undefined;
    if (typeof key !== 'string' || keyed.has(key)) {
      return undefined;
    }

    keyed.set(key, entry);
  }

  return keyed;
};

const isScalar = (value: unknown): value is string | number | boolean =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

/** Every difference between two values, at its path: a key added, removed or changed, an entry of a named list. */
const differences = (path: string, before: unknown, after: unknown, out: string[]): void => {
  if (same(before, after)) {
    return;
  }

  if (before === undefined) {
    out.push(`${path} = ${shown(after)}`);

    return;
  }

  if (after === undefined) {
    out.push(`${path} removed (was ${shown(before)})`);

    return;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const was = keyedList(before);
    const is = keyedList(after);
    if (was && is) {
      for (const key of new Set([...was.keys(), ...is.keys()])) {
        differences(`${path}[${key}]`, was.get(key), is.get(key), out);
      }

      if (
        [...was.keys()].join('\n') !== [...is.keys()].join('\n') &&
        same([...was.keys()].toSorted(), [...is.keys()].toSorted())
      ) {
        out.push(`${path} reordered`);
      }

      return;
    }

    if (before.every(isScalar) && after.every(isScalar)) {
      const added = after.filter(item => !before.includes(item));
      const removed = before.filter(item => !after.includes(item));
      if (added.length > 0 || removed.length > 0) {
        out.push(
          `${path}: ${[...added.map(item => `+${shown(item)}`), ...removed.map(item => `−${shown(item)}`)].join(' ')}`
        );
      } else {
        out.push(`${path}: ${shown(before)} → ${shown(after)}`);
      }

      return;
    }
  }

  if (isRecord(before) && isRecord(after)) {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      differences(`${path}.${key}`, before[key], after[key], out);
    }

    return;
  }

  out.push(`${path}: ${shown(before)} → ${shown(after)}`);
};

/** A key of a record, or nothing when it has none — said as such, where indexing would claim it is there. */
const lookup = <T>(record: Record<string, T>, key: string): T | undefined =>
  Object.hasOwn(record, key) ? record[key] : undefined;

/** An object without the keys a caller reads apart. */
const without = (value: object, keys: readonly string[]): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

const classesOf = (selector: string | undefined): string[] => (selector ?? '').split(/\s+/).filter(Boolean);

/** An element's own changes: its attributes, its classes, where it is, and the rest of its definition. */
const elementChanges = (id: string, before: Element, after: Element, out: string[]): void => {
  const bound = new Map(
    (after.definition.bindings?.attributes ?? []).map((binding): [string, string] => [binding.to, binding.source])
  );
  for (const key of new Set([...Object.keys(before.attributes), ...Object.keys(after.attributes)])) {
    const lines: string[] = [];
    differences(`${id}.${key}`, before.attributes[key], after.attributes[key], lines);
    const source = bound.get(key);
    // What a binding feeds is what the page shows: the value written here is not, and saying only that it changed
    // would let the agent believe the page did.
    out.push(
      ...(source ? lines.map(line => `${line} — bound to ${source}: the page shows the binding's value`) : lines)
    );
  }

  const { parentId: wasIn, items: hadItems, styleSelectors: wore } = before.definition;
  const { parentId: isIn, items: hasItems, styleSelectors: wears } = after.definition;
  if (wasIn !== isIn) {
    out.push(`${id} moved from ${wasIn ?? 'the top'} to ${isIn ?? 'the top'}`);
  }

  // Children added, removed or moved are said of each child; only the same children in another order are said here.
  if (!same(hadItems, hasItems) && same([...(hadItems ?? [])].toSorted(), [...(hasItems ?? [])].toSorted())) {
    out.push(`${id}'s children reordered`);
  }

  for (const selector of new Set([...Object.keys(wore), ...Object.keys(wears)])) {
    const was = classesOf(wore[selector]);
    const is = classesOf(wears[selector]);
    const added = is.filter(name => !was.includes(name));
    const removed = was.filter(name => !is.includes(name));
    if (added.length > 0 || removed.length > 0) {
      const changes = [...added.map(name => `+${name}`), ...removed.map(name => `−${name}`)].join(' ');
      out.push(`${id} classes${selector === 'base' ? '' : ` (${selector})`}: ${changes}`);
    } else if (was.join(' ') !== is.join(' ')) {
      out.push(`${id} classes${selector === 'base' ? '' : ` (${selector})`} reordered`);
    }
  }

  const apart = ['parentId', 'items', 'styleSelectors'];
  differences(id, without(before.definition, apart), without(after.definition, apart), out);
};

/** The elements added to a tree, or taken from it, said by the outermost of each subtree with how many it held. */
const subtrees = (
  ids: Set<string>,
  flat: Record<string, Element>,
  verb: string,
  where: string,
  out: string[]
): void => {
  const top = (id: string): string => {
    const parentId = flat[id].definition.parentId;

    return parentId !== undefined && ids.has(parentId) ? top(parentId) : id;
  };
  const held = new Map<string, number>();
  for (const id of ids) {
    const root = top(id);
    held.set(root, (held.get(root) ?? 0) + (root === id ? 0 : 1));
  }

  for (const [id, inside] of held) {
    const { type, parentId } = flat[id].definition;
    out.push(
      `${id} (${type}) ${verb}${parentId ? ` ${verb === 'added' ? 'in' : 'from'} ${parentId}` : ''}${where}${inside > 0 ? `, with ${String(inside)} inside` : ''}`
    );
  }
};

const treeChanges = (
  before: Record<string, Element>,
  after: Record<string, Element>,
  where: string,
  out: string[]
): void => {
  const added = new Set(Object.keys(after).filter(id => !(id in before)));
  const removed = new Set(Object.keys(before).filter(id => !(id in after)));
  subtrees(added, after, 'added', where, out);
  subtrees(removed, before, 'removed', where, out);
  for (const id of Object.keys(after)) {
    const was = lookup(before, id);
    if (was) {
      elementChanges(id, was, after[id], out);
    }
  }
};

export const effectsOf = (before: Space, after: Space): string[] => {
  const out: string[] = [];
  treeChanges(before.schema.flat, after.schema.flat, '', out);

  const components = new Set([...Object.keys(before.schema.components), ...Object.keys(after.schema.components)]);
  for (const id of components) {
    const was = lookup(before.schema.components, id);
    const is = lookup(after.schema.components, id);
    if (!was || !is) {
      const held = Object.keys((was ?? is)?.flat ?? {}).length;
      out.push(`component ${id} ${was ? 'removed' : 'added'}, ${String(held)} elements`);
      continue;
    }

    treeChanges(was.flat, is.flat, ` (component ${id})`, out);
    differences(`component ${id}`, without(was, ['flat']), without(is, ['flat']), out);
  }

  differences(
    'space',
    without(before.schema, ['flat', 'components', 'pages']),
    without(after.schema, ['flat', 'components', 'pages']),
    out
  );
  // A page added or removed is said as its element; what is left to say of the list is its order.
  differences(
    'space.pages',
    before.schema.pages.filter(id => after.schema.pages.includes(id)),
    after.schema.pages.filter(id => before.schema.pages.includes(id)),
    out
  );
  // The compiled CSS follows from the rest: a change to it is a change of a class, said as that.
  differences('style', without(before.style, ['cache']), without(after.style, ['cache']), out);
  differences('connectors', before.connectors, after.connectors, out);
  differences('actions', before.actions, after.actions, out);
  differences('functions', before.functions, after.functions, out);
  differences('data', before.data, after.data, out);

  return out.length > LIMIT
    ? [
        ...out.slice(0, LIMIT),
        `… and ${String(out.length - LIMIT)} more changes: read the resources listed in \`changed\``
      ]
    : out;
};
