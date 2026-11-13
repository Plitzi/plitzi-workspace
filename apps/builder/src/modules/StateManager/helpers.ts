import { STATE_PATH_PARAMS } from '@plitzi/sdk-authoring';
import { hasValidToken } from '@plitzi/sdk-shared/helpers/twigWrapper';
import { elementPaths } from '@pmodules/Usages/helpers/usageIndex';

import type { Element, Schema } from '@plitzi/sdk-shared';

/** A top-level key of `runtime.state` the space uses: the elements that read it and those whose steps write it. */
export type StateKeyUse = { key: string; reads: string[]; writes: string[] };

/** The key a path into the state names: `state.cart.items` → `cart`; a templated or empty one names none. */
const keyOfPath = (path: string): string | undefined => {
  const bare = path.replace(/^(?:runtime\.)?state\./, '');
  const key = bare.split(/[.[]/)[0];

  return key && !hasValidToken(bare) ? key : undefined;
};

const entryOf = (keys: Map<string, StateKeyUse>, key: string): StateKeyUse => {
  let found = keys.get(key);
  if (!found) {
    found = { key, reads: [], writes: [] };
    keys.set(key, found);
  }

  return found;
};

/** Every element of the pages' tree and of each component's. */
const elementsOf = (schema: Pick<Schema, 'flat' | 'components'>): Element[] =>
  [schema.flat, ...Object.values(schema.components).map(component => component.flat)].flatMap(flat =>
    Object.values(flat)
  );

/**
 * The keys of `runtime.state` the space uses, each with what reads it — a binding, a template, a `when` — and what
 * writes it: a step of the state's (`setState`, `toggleState`…, by the params `STATE_PATH_PARAMS` names). Read off the
 * documents, so a key shows here before the page has ever set it.
 */
export const stateKeysOf = (schema: Pick<Schema, 'flat' | 'components'>): Map<string, StateKeyUse> => {
  const keys = new Map<string, StateKeyUse>();
  for (const element of elementsOf(schema)) {
    for (const path of elementPaths(element)) {
      const key = path.startsWith('state.') ? keyOfPath(path) : undefined;
      if (key && !entryOf(keys, key).reads.includes(element.id)) {
        entryOf(keys, key).reads.push(element.id);
      }
    }

    for (const step of Object.values(element.definition.interactions ?? {})) {
      if (step.type !== 'globalCallback' || step.elementId !== 'state') {
        continue;
      }

      for (const param of STATE_PATH_PARAMS[step.action] ?? []) {
        const value = step.params[param];
        const key = typeof value === 'string' ? keyOfPath(value) : undefined;
        if (key && !entryOf(keys, key).writes.includes(element.id)) {
          entryOf(keys, key).writes.push(element.id);
        }
      }
    }
  }

  return keys;
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
