import { STATE_PATH_PARAMS } from '@plitzi/sdk-authoring';
import { isRecord } from '@plitzi/sdk-shared/helpers';
import { elementPaths } from '@pmodules/Usages/helpers/usageIndex';

import type { Element, Schema } from '@plitzi/sdk-shared';

/**
 * A path of `runtime.state` the space uses — a top-level key or one under it (`cart.items.0.name`) — with the elements
 * that read it or anything under it, those whose steps write it or anything under it, and the keys under it the space
 * names. `path` joins the keys with dots.
 */
export type StatePathUse = { path: string; reads: string[]; writes: string[]; children: string[] };

/**
 * The keys a path into the state names: `state.cart.items[0].name` → `cart`, `items`, `0`, `name`. A template stops it
 * (`cart.{{ props.key }}` names `cart` alone) and one that starts with a template names none.
 */
export const segmentsOf = (path: string): string[] => {
  const bare = path.replace(/^(?:runtime\.)?state\./, '');
  const template = bare.search(/\{[{%]/);
  const named = (template === -1 ? bare : bare.slice(0, template))
    .replace(/\[\s*['"]?([^\]'"]*?)['"]?\s*\]/g, '.$1')
    .replace(/\[[^\]]*$/, '.');
  const segments = named.split('.');
  if (template !== -1) {
    // The key the template runs into (`item{{ i }}`, or the empty one after `cart.`) is not a key of its own.
    segments.pop();
  }

  return segments.filter(Boolean);
};

/** Every element of the pages' tree and of each component's. */
const elementsOf = (schema: Pick<Schema, 'flat' | 'components'>): Element[] =>
  [schema.flat, ...Object.values(schema.components).map(component => component.flat)].flatMap(flat =>
    Object.values(flat)
  );

/**
 * The paths of `runtime.state` the space uses, each with what reads it — a binding, a template, a `when` — and what
 * writes it: a step of the state's (`setState`, `toggleState`…, by the params `STATE_PATH_PARAMS` names). A use counts
 * for its path and every path above it, so `cart` says what `cart.total` does too. Read off the documents, so a path
 * shows here before the page has ever set it.
 */
export const statePathsOf = (schema: Pick<Schema, 'flat' | 'components'>): Map<string, StatePathUse> => {
  const paths = new Map<string, StatePathUse>();
  const note = (segments: string[], id: string, how: 'reads' | 'writes') => {
    for (let depth = 1; depth <= segments.length; depth += 1) {
      const path = segments.slice(0, depth).join('.');
      let use = paths.get(path);
      if (!use) {
        use = { path, reads: [], writes: [], children: [] };
        paths.set(path, use);
      }

      if (!use[how].includes(id)) {
        use[how].push(id);
      }

      const child = segments.at(depth);
      if (child !== undefined && !use.children.includes(child)) {
        use.children.push(child);
      }
    }
  };

  for (const element of elementsOf(schema)) {
    for (const path of elementPaths(element)) {
      if (path.startsWith('state.')) {
        note(segmentsOf(path), element.id, 'reads');
      }
    }

    for (const step of Object.values(element.definition.interactions ?? {})) {
      if (step.type !== 'globalCallback' || step.elementId !== 'state') {
        continue;
      }

      for (const param of STATE_PATH_PARAMS[step.action] ?? []) {
        const value = step.params[param];
        if (typeof value === 'string') {
          note(segmentsOf(value), element.id, 'writes');
        }
      }
    }
  }

  return paths;
};

/** The top-level keys among the paths the space uses: the rows of the table. */
export const topKeysOf = (paths: Map<string, StatePathUse>): Map<string, StatePathUse> =>
  new Map([...paths].filter(([path]) => !path.includes('.')));

/** The deepest paths the space names under a key, with their uses: `cart` → `cart.items.0.name`, `cart.total`. */
export const subPathsOf = (paths: Map<string, StatePathUse>, key: string): StatePathUse[] =>
  [...paths.values()]
    .filter(use => use.path.startsWith(`${key}.`) && use.children.length === 0)
    .sort((a, b) => a.path.localeCompare(b.path));

/** An object or a list: a value with keys under it. */
export const isBranch = (value: unknown): value is Record<string, unknown> | unknown[] =>
  Array.isArray(value) || isRecord(value);

/** The value under one key of an object or one index of a list; nothing under anything else. */
export const childOf = (value: unknown, key: string): unknown => {
  if (Array.isArray(value)) {
    const list: unknown[] = value;

    return list[Number(key)];
  }

  return isRecord(value) ? value[key] : undefined;
};

/** The value at a path: `cart`, `items`, `0` → the cart's first item. */
export const valueAt = (value: unknown, segments: string[]): unknown =>
  segments.reduce<unknown>((current, segment) => childOf(current, segment), value);

const writeAt = (target: unknown, segments: string[], value: unknown): unknown => {
  if (segments.length === 0) {
    return value;
  }

  const [head, ...rest] = segments;
  if (Array.isArray(target) && /^\d+$/.test(head)) {
    const list: unknown[] = target;
    const copy = [...list];
    copy[Number(head)] = writeAt(copy[Number(head)], rest, value);

    return copy;
  }

  const base = isRecord(target) ? target : {};

  return { ...base, [head]: writeAt(base[head], rest, value) };
};

/**
 * The state with one path set — every object and list on the way copied, a missing one made an object — so the page
 * sees a new state and only that path changed.
 */
export const setInState = (
  state: Record<string, unknown>,
  [key, ...rest]: [string, ...string[]],
  value: unknown
): Record<string, unknown> => ({ ...state, [key]: writeAt(state[key], rest, value) });

/** What a branch holds, in a few characters: `{3}` for an object of 3 keys, `[12]` for a list of 12. */
export const shapeOf = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    return `[${String(value.length)}]`;
  }

  return isRecord(value) ? `{${String(Object.keys(value).length)}}` : undefined;
};

/** How a key of the state outlives the page, as the space's settings say (`keepState` and its lists). */
export type Persistence = { kept: boolean; painted: boolean; browser: boolean; reason: string };

/** What the space's settings keep of one top-level key of the state. */
export const persistenceOf = (settings: Schema['settings'], key: string): Persistence => {
  const listed = (list: string[] | undefined): boolean => list?.includes(key) === true;
  if (settings.keepState !== true) {
    return { kept: false, painted: false, browser: false, reason: 'Nothing is kept: the space keeps no state' };
  }

  if (listed(settings.transientState)) {
    return { kept: false, painted: false, browser: false, reason: 'Never kept: settings.transientState names it' };
  }

  if ((settings.keptState?.length ?? 0) > 0 && !listed(settings.keptState)) {
    return { kept: false, painted: false, browser: false, reason: 'Not kept: settings.keptState names the others' };
  }

  const painted = listed(settings.paintedState);
  const browser = listed(settings.browserState);

  return {
    kept: true,
    painted,
    browser,
    reason: [
      'Kept between visits',
      painted ? 'and drawn by the server with it (paintedState)' : '',
      browser ? 'by the browser, whoever signs in (browserState)' : ''
    ]
      .filter(Boolean)
      .join(', ')
  };
};

/** A value read as what was typed: JSON when it is (a number, true, a list), the words themselves otherwise. */
export const parseTyped = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/** A value in a line: what a change or a computed value shows. */
export const preview = (value: unknown): string => {
  if (value === undefined) {
    return '—';
  }

  const text = JSON.stringify(value);

  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
};
