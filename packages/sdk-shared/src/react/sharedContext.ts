import { createContext } from 'react';

import type { Context } from 'react';

/**
 * Bumped when a shared context's value changes shape in a way an older copy could not read: copies on either side of
 * the bump then keep contexts of their own rather than handing each other values they would misread.
 */
const SHARED_CONTEXTS_VERSION = 1;

const REGISTRY = Symbol.for(`plitzi.sharedContexts.v${String(SHARED_CONTEXTS_VERSION)}`);

type Registry = Map<string, Context<unknown>>;

const registryOf = (scope: typeof globalThis & { [REGISTRY]?: Registry }): Registry => {
  scope[REGISTRY] ??= new Map();

  return scope[REGISTRY];
};

/**
 * A React context every copy of the Plitzi runtime on a page agrees on.
 *
 * One page can hold more than one copy. The builder carries its own and renders a space's elements with it, while a
 * remote plugin imports `@plitzi/plitzi-sdk` — the SDK's copy — through the page's import map; the builder embedded in
 * Plitzi's own site is a third, the site's. A context made with `createContext` belongs to the copy that made it, so a
 * plugin in the builder's canvas read none of the canvas's providers: it fell through to the site around the builder,
 * took its element for the plugin's own, its live mode for the editor's and its store for the space's.
 *
 * Made once per page, under `name`, by whichever copy asks first, and handed to every other: a provider from any copy
 * is then seen by a consumer from any copy, and the nearest one wins as it should.
 */
export const sharedContext = <T>(name: string, defaultValue: T): Context<T> => {
  const registry = registryOf(globalThis);
  const found = registry.get(name);
  if (found) {
    // Registered under this name by `sharedContext` alone, which only ever stores the context it made for that name's
    // value type: every caller of a name declares the same type, so reading it back as that type is sound.
    return found as Context<T>;
  }

  const context = createContext(defaultValue);
  context.displayName = name;
  registry.set(name, context as Context<unknown>);

  return context;
};
