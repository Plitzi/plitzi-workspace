import type { ChangeEntry, ChangeKind } from './types';
import type { DisplayMode, Schema, Style, StyleItem } from '../types';

/**
 * Structural equality for documents as they are stored: JSON — objects, arrays and scalars, nothing else.
 *
 * Written out rather than borrowed because it runs on every save of a space, over every element of it, and almost
 * every pair it compares is equal: what it has to be is a walk that stops at the first difference, with nothing to
 * set up per call.
 */
export const sameValue = (a: unknown, b: unknown): boolean => {
  if (a === b) {
    return true;
  }

  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }

  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => sameValue(item, b[index]));
  }

  // Plain objects by now: arrays and scalars are handled above, and a stored document holds nothing else.
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left).filter(key => left[key] !== undefined);
  if (keys.length !== Object.keys(right).filter(key => right[key] !== undefined).length) {
    return false;
  }

  return keys.every(key => Object.hasOwn(right, key) && sameValue(left[key], right[key]));
};

/**
 * A copy of a stored document, for the model that has to remember what it last saved.
 *
 * JSON rather than a structural clone: documents are JSON by definition, and the round trip measures about half of
 * `cloneDeep` on a 5 000-element schema — a cost every save of a space pays.
 */
export const jsonCopy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Every entity of one kind that differs between two keyed collections. */
const diffKeyed = (
  kind: ChangeKind,
  before: Record<string, unknown>,
  after: Record<string, unknown>
): ChangeEntry[] => {
  const entries: ChangeEntry[] = [];
  for (const [id, value] of Object.entries(after)) {
    if (!Object.hasOwn(before, id)) {
      entries.push({ kind, id, op: 'add', after: value });
    } else if (!sameValue(before[id], value)) {
      entries.push({ kind, id, op: 'update', before: before[id], after: value });
    }
  }

  for (const [id, value] of Object.entries(before)) {
    if (!Object.hasOwn(after, id)) {
      entries.push({ kind, id, op: 'remove', before: value });
    }
  }

  return entries;
};

const byKey = <T>(items: T[] | undefined, key: (item: T) => string): Record<string, T> =>
  Object.fromEntries((items ?? []).map(item => [key(item), item]));

/** An object's own keys as settings of one prefix, so each one that changes is its own entry. */
const settingsOf = (prefix: string, value: object | undefined): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value ?? {}).map(([key, setting]) => [`${prefix}.${key}`, setting]));

/** The part of a schema a history reads: what is stored, never what the runtime derives from it. */
export type HistorySchema = Pick<Schema, 'flat' | 'pages' | 'pageFolders' | 'variables' | 'settings' | 'definition'>;

/**
 * What changed between two versions of a schema, entity by entity.
 *
 * An element is one entity: whatever changed inside it — an attribute, a binding, a flow, its place in the tree —
 * the entry carries it whole, before and after. Pages are elements; their ORDER is the setting `pages`.
 */
export const diffSchema = (before: Partial<HistorySchema>, after: Partial<HistorySchema>): ChangeEntry[] => [
  ...diffKeyed('element', before.flat ?? {}, after.flat ?? {}),
  ...diffKeyed(
    'folder',
    byKey(before.pageFolders, folder => folder.id),
    byKey(after.pageFolders, folder => folder.id)
  ),
  ...diffKeyed(
    'variable',
    byKey(before.variables, variable => variable.name),
    byKey(after.variables, variable => variable.name)
  ),
  ...diffKeyed(
    'setting',
    { ...settingsOf('settings', before.settings), ...settingsOf('definition', before.definition), pages: before.pages },
    { ...settingsOf('settings', after.settings), ...settingsOf('definition', after.definition), pages: after.pages }
  )
];

const SELECTOR_KINDS: Record<StyleItem['type'], ChangeKind> = {
  class: 'selector',
  element: 'globalStyle',
  id: 'idStyle'
};

/** A style's selectors by name, each holding what it is on every display mode that declares it. */
const selectorsOf = (platform: Style['platform'] | undefined): Partial<Record<ChangeKind, Record<string, unknown>>> => {
  const grouped: Partial<Record<ChangeKind, Record<string, Partial<Record<DisplayMode, StyleItem>>>>> = {};
  for (const [displayMode, items] of Object.entries(platform ?? {}) as [DisplayMode, Record<string, StyleItem>][]) {
    for (const [name, item] of Object.entries(items)) {
      const kind = SELECTOR_KINDS[item.type];
      const byName = (grouped[kind] ??= {});
      (byName[name] ??= {})[displayMode] = item;
    }
  }

  return grouped;
};

const tokensOf = (variables: Style['variables'] | undefined): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(variables ?? {}).flatMap(([category, group]) =>
      Object.entries(group).map(([name, value]) => [`${category}/${name}`, value])
    )
  );

/** The part of a style a history reads. Its `cache` is not: it is the whole stylesheet, compiled from the rest. */
export type HistoryStyle = Pick<Style, 'platform' | 'variables' | 'fonts' | 'theme' | 'mode'>;

/**
 * What changed between two versions of a style. A selector is one entity across the display modes, so "tablet only"
 * reads as one change to it, with the modes compared inside the entry.
 */
export const diffStyle = (before: Partial<HistoryStyle>, after: Partial<HistoryStyle>): ChangeEntry[] => {
  const beforeSelectors = selectorsOf(before.platform);
  const afterSelectors = selectorsOf(after.platform);

  return [
    ...(['selector', 'globalStyle', 'idStyle'] as const).flatMap(kind =>
      diffKeyed(kind, beforeSelectors[kind] ?? {}, afterSelectors[kind] ?? {})
    ),
    ...diffKeyed('token', tokensOf(before.variables), tokensOf(after.variables)),
    ...diffKeyed(
      'font',
      byKey(before.fonts, font => font.family),
      byKey(after.fonts, font => font.family)
    ),
    ...diffKeyed('setting', { theme: before.theme, mode: before.mode }, { theme: after.theme, mode: after.mode })
  ];
};

const KIND_NOUNS: Record<ChangeKind, string> = {
  element: 'element',
  folder: 'folder',
  variable: 'variable',
  setting: 'setting',
  selector: 'class',
  globalStyle: 'global style',
  idStyle: 'id style',
  token: 'token',
  font: 'font'
};

const VERBS: Record<ChangeEntry['op'], string> = { add: 'Added', update: 'Updated', remove: 'Removed' };

/** One line a timeline row can show: "Added class card; Updated element hero, cta". Names stop at three per group. */
export const summarizeChange = (entries: ChangeEntry[]): string =>
  (['add', 'update', 'remove'] as const)
    .flatMap(op =>
      Object.entries(
        entries
          .filter(entry => entry.op === op)
          .reduce<Record<string, string[]>>((groups, entry) => {
            (groups[KIND_NOUNS[entry.kind]] ??= []).push(entry.id);

            return groups;
          }, {})
      ).map(([noun, ids]) => {
        const names = ids.length > 3 ? `${ids.slice(0, 3).join(', ')} and ${ids.length - 3} more` : ids.join(', ');

        return `${VERBS[op]} ${noun} ${names}`;
      })
    )
    .join('; ');
