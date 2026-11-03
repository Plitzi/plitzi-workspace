import { sharedContext } from '../../helpers/sharedContext';

import type { ComponentContextValue, PluginsContextValue } from '../../types';

/** What a container draws its items from: the components registered, their definitions, and the space's plugins. */
export type ElementRegistrySnapshot = {
  components: ComponentContextValue['components'];
  componentDefinitions: ComponentContextValue['componentDefinitions'];
  plugins: PluginsContextValue['plugins'];
};

/**
 * The registries, as one object that is the same for the life of the page — read with `get`, followed with `subscribe`.
 *
 * `ComponentContext` and `PluginsContext` take a new value whenever anything joins them (a plugin the page loads after
 * it hydrated, the host's own components), and a context's every reader draws again on each: every container of the
 * page, once per arrival. A container on a published page follows this one instead, and draws again only when what IT
 * draws changed — whether its items' types are registered (`useInternalItems`).
 */
export type ElementRegistry = {
  get: () => ElementRegistrySnapshot;
  subscribe: (listener: () => void) => () => void;
};

/** The registry a provider keeps: what `ElementRegistry` reads, and `set`, which tells every follower. */
export const createElementRegistry = (
  initial: ElementRegistrySnapshot
): ElementRegistry & { set: (next: ElementRegistrySnapshot) => void } => {
  let current = initial;
  const listeners = new Set<() => void>();

  return {
    get: () => current,
    subscribe: listener => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    set: next => {
      if (
        next.components === current.components &&
        next.componentDefinitions === current.componentDefinitions &&
        next.plugins === current.plugins
      ) {
        return;
      }

      current = next;
      listeners.forEach(listener => {
        listener();
      });
    }
  };
};

/** Absent where nothing keeps one (the builder's canvas, a bare test): its readers read the two contexts themselves. */
const ElementRegistryContext = sharedContext<ElementRegistry | undefined>('ElementRegistryContext', undefined);

export default ElementRegistryContext;
