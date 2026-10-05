import { useSyncExternalStore } from 'react';

import type { ComponentPluginFC } from '@plitzi/sdk-shared';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a plugin's props are its host element's attributes.
type PluginComponent = ComponentPluginFC<any>;

/**
 * What a plugin declares about itself — its triggers, its actions, its element — as one comparable text. A swap is only
 * a swap while this stays the same: the space was checked, and the builder drew its panel, against the old one.
 */
const declarationOf = (component: PluginComponent): string | undefined => {
  try {
    // Its own fields — the declaration `index.ts` assigned onto it — not the function, which stringifies to nothing.
    return JSON.stringify({ ...component }, (_key, value: unknown) =>
      typeof value === 'function' ? undefined : value
    );
  } catch {
    return undefined;
  }
};

/**
 * Plugins a development page can swap while it runs: each one is registered as a proxy that never changes and
 * renders whichever component is current, so swapping one re-mounts the elements of that type alone — the rest of the
 * page, its state and its scroll, stays as it was. A plugin's own state starts again: it is a new component.
 *
 * The proxy carries the plugin's statics (its declaration, its settings panel) as the original did, so nothing that
 * reads them can tell the difference.
 */
export const createHotPlugins = <T extends { component: PluginComponent }>(plugins: Record<string, T>) => {
  const current = new Map<string, PluginComponent>();
  const listeners = new Map<string, Set<() => void>>();
  const proxies = new Map<string, PluginComponent>();

  const subscribe = (key: string) => (onChange: () => void) => {
    const set = listeners.get(key) ?? new Set();
    set.add(onChange);
    listeners.set(key, set);

    return () => {
      set.delete(onChange);
    };
  };

  const proxyFor = (key: string, component: PluginComponent): PluginComponent => {
    const listen = subscribe(key);
    const read = () => current.get(key) ?? component;
    const HotPlugin: PluginComponent = props => {
      const Current = useSyncExternalStore(listen, read, read);

      return <Current {...props} />;
    };
    HotPlugin.displayName = `Hot(${component.displayName ?? component.name})`;

    return Object.assign(HotPlugin, component);
  };

  const registered = Object.fromEntries(
    Object.entries(plugins).map(([key, plugin]) => {
      current.set(key, plugin.component);
      const proxy = proxyFor(key, plugin.component);
      proxies.set(key, proxy);

      return [key, { ...plugin, component: proxy }];
    })
  ) as Record<string, T>;

  /**
   * Puts `next` where the plugin `key` is drawn. `false` when it cannot be swapped in place — a plugin this page never
   * registered, or one whose declaration changed — and the page has to load again.
   */
  const replace = (key: string, next: PluginComponent): boolean => {
    const previous = current.get(key);
    const proxy = proxies.get(key);
    if (!previous || !proxy || declarationOf(previous) !== declarationOf(next)) {
      return false;
    }

    current.set(key, next);
    listeners.get(key)?.forEach(onChange => {
      onChange();
    });

    return true;
  };

  return { plugins: registered, replace };
};
