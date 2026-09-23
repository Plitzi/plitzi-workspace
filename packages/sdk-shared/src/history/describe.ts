import type { ChangeEntry, ChangeKind } from './types';

export type FieldChange = { path: string; before?: unknown; after?: unknown };

/** What a line says was done, for a reader who scans the icon before the words. */
export type ChangeAction = 'add' | 'remove' | 'move' | 'update' | 'reorder';

/** One thing a save did, in words, and the element it is about when it is about one. */
export type ChangeLine = { text: string; action: ChangeAction; elementId?: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * What changed inside one entity, field by field (`attributes.content`, `definition.items`). Objects are walked; a list
 * or a value is compared whole, since "the third item moved" reads worse than the list before and after.
 */
export const fieldChanges = (before: unknown, after: unknown, path = ''): FieldChange[] => {
  if (isRecord(before) && isRecord(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];

    return keys.flatMap(key => fieldChanges(before[key], after[key], path ? `${path}.${key}` : key));
  }

  if (JSON.stringify(before) === JSON.stringify(after)) {
    return [];
  }

  return [{ path, ...(before !== undefined ? { before } : {}), ...(after !== undefined ? { after } : {}) }];
};

/** The part of a stored element a description reads. Everything is optional: a truncated change carries no values. */
type ElementShape = { definition?: { type?: string; parentId?: string | null; items?: string[] } };

const shapeOf = (value: unknown): ElementShape => (isRecord(value) ? value : {});

/** What an element is, in words: `page`, `layout`, `text`, `api container`. */
const typeName = (value: unknown): string => {
  const type = shapeOf(value).definition?.type;
  if (!type) {
    return 'element';
  }

  if (type === 'layoutContainer') {
    return 'layout';
  }

  return type.replace(/([a-z])([A-Z])/gu, '$1 $2').toLowerCase();
};

const parentOf = (value: unknown): string | undefined => shapeOf(value).definition?.parentId ?? undefined;

/** An element named with what it is, when this change tells: `page test`, or just `test`. */
const nameOf = (id: string, known: Map<string, unknown>): string => {
  const value = known.get(id);

  return value === undefined ? `“${id}”` : `${typeName(value)} “${id}”`;
};

/**
 * What a changed field is, as a person calls it. Attributes by their own name; the parts of the definition by what they
 * do. `definition.items` and `definition.parentId` are the tree, said by the lines about children and moves instead.
 */
const fieldName = (path: string): string | undefined => {
  const parts = path.split('.');
  const root = parts[0];
  // A path of one segment is a field of its own at the top of the element.
  const key = parts.length > 1 ? parts[1] : root;
  if (root === 'attributes') {
    return key;
  }

  const names: Record<string, string | undefined> = {
    label: 'label',
    styleSelectors: 'classes',
    bindings: 'bindings',
    interactions: 'interactions',
    initialState: 'initial state',
    items: undefined,
    parentId: undefined,
    rootId: undefined,
    type: 'type'
  };

  return Object.hasOwn(names, key) ? names[key] : key;
};

const listOf = (names: string[], max = 3): string =>
  names.length > max ? `${names.slice(0, max).join(', ')} and ${names.length - max} more` : names.join(', ');

const KIND_NOUN: Record<Exclude<ChangeKind, 'element'>, string> = {
  folder: 'folder',
  variable: 'variable',
  setting: 'setting',
  selector: 'class',
  globalStyle: 'global style for',
  idStyle: 'id style',
  token: 'token',
  font: 'font'
};

const VERB: Record<ChangeEntry['op'], string> = { add: 'Added', update: 'Changed', remove: 'Removed' };

/** The display modes a selector changed on, for a class that holds one entry per mode. */
const modesChanged = (before: unknown, after: unknown): string[] => {
  const left = isRecord(before) ? before : {};
  const right = isRecord(after) ? after : {};

  return [...new Set([...Object.keys(left), ...Object.keys(right)])].filter(
    mode => JSON.stringify(left[mode]) !== JSON.stringify(right[mode])
  );
};

type OtherEntry = ChangeEntry & { kind: Exclude<ChangeKind, 'element'> };

const isOther = (entry: ChangeEntry): entry is OtherEntry => entry.kind !== 'element';

const describeOther = (entry: OtherEntry): ChangeLine => {
  const { kind } = entry;
  if (kind === 'setting' && entry.id === 'pages') {
    return { text: 'Reordered the pages', action: 'reorder' };
  }

  const text = `${VERB[entry.op]} ${KIND_NOUN[kind]} “${entry.id}”`;
  if (entry.op === 'update' && (kind === 'selector' || kind === 'globalStyle' || kind === 'idStyle')) {
    const modes = modesChanged(entry.before, entry.after);

    return { text: modes.length > 0 ? `${text} on ${modes.join(', ')}` : text, action: entry.op };
  }

  return { text, action: entry.op };
};

/** Each line once, the first time it is said. */
export const uniqueLines = (lines: ChangeLine[]): ChangeLine[] => {
  const seen = new Set<string>();

  return lines.filter(line => {
    if (seen.has(line.text)) {
      return false;
    }

    seen.add(line.text);

    return true;
  });
};

/**
 * One save, as lines a person reads: each thing it did, said once and in words.
 *
 * Adding an element also rewrites its parent's list of children, and a move rewrites two; those are the consequence of
 * the add or the move, so they are not said again. A parent whose children changed for no other reason in the same
 * save — a reorder — is said as that.
 */
export const describeChange = (entries: ChangeEntry[]): ChangeLine[] => {
  const elements = entries.filter(entry => entry.kind === 'element');
  const known = new Map<string, unknown>(elements.map(entry => [entry.id, entry.after ?? entry.before]));
  // Children whose place in the tree this save explains: added, removed or moved.
  const placed = new Set(
    elements
      .filter(entry => entry.op !== 'update' || parentOf(entry.before) !== parentOf(entry.after))
      .map(entry => entry.id)
  );
  const lines: ChangeLine[] = [];

  for (const entry of elements) {
    const self = nameOf(entry.id, known);
    const say = (text: string, action: ChangeAction) => lines.push({ text, action, elementId: entry.id });

    if (entry.op === 'add') {
      const parent = parentOf(entry.after);
      say(parent ? `Added ${self} to ${nameOf(parent, known)}` : `Added ${self}`, 'add');
      continue;
    }

    if (entry.op === 'remove') {
      const parent = parentOf(entry.before);
      say(parent ? `Removed ${self} from ${nameOf(parent, known)}` : `Removed ${self}`, 'remove');
      continue;
    }

    const from = parentOf(entry.before);
    const to = parentOf(entry.after);
    if (from !== to && from && to) {
      say(`Moved ${self} from ${nameOf(from, known)} to ${nameOf(to, known)}`, 'move');
    }

    const changes = fieldChanges(entry.before, entry.after);
    const fields = [
      ...new Set(changes.map(change => fieldName(change.path)).filter((name): name is string => name !== undefined))
    ];
    if (fields.length > 0) {
      say(`Changed ${listOf(fields)} of ${self}`, 'update');
    }

    // The children this save does not account for elsewhere: if their order moved, that is a reorder of its own.
    const kept = (value: unknown) => (shapeOf(value).definition?.items ?? []).filter(id => !placed.has(id));
    const childrenChanged = changes.some(change => change.path === 'definition.items');
    if (childrenChanged && JSON.stringify(kept(entry.before)) !== JSON.stringify(kept(entry.after))) {
      say(`Reordered the children of ${self}`, 'reorder');
    }

    // A change nothing above could name (a truncated record, or a field of its own): at least say it was touched.
    if (changes.length === 0 || (fields.length === 0 && !childrenChanged && from === to)) {
      say(`Changed ${self}`, 'update');
    }
  }

  lines.push(...entries.filter(isOther).map(describeOther));

  return uniqueLines(lines);
};
