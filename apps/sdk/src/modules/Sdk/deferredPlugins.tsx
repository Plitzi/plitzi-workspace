import { lazy, Suspense } from 'react';

import type { ComponentPluginFC, PluginDeclaration } from '@plitzi/sdk-shared';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a plugin's props are its host element's attributes.
export type PluginComponent = ComponentPluginFC<any> & { plugins?: Record<string, PluginComponent> };

/** A plugin this page draws none of: what it declares now, its code and stylesheet when a page draws it. */
export type DeferredPlugin = {
  load: () => Promise<{ default: PluginComponent }>;
  css?: string | null;
  declaration: PluginDeclaration;
};

// Settles either way: a stylesheet that failed leaves the plugin unstyled, which beats a plugin that never draws.
const loadStylesheet = (href: string, key: string): Promise<void> =>
  new Promise(resolve => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    // The attribute a development page finds a plugin's stylesheet by, to point it at a rebuild.
    link.dataset.plitziPlugin = key;
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.append(link);
  });

/**
 * The plugin registered as `key`, standing in for itself until it is drawn.
 *
 * It carries the declaration — the definition, the sub-plugins, each a stand-in of its own — so the space knows its
 * types from the start. The first one drawn loads the code and the stylesheet, once, before anything of it mounts: the
 * stylesheet first, or the plugin would paint unstyled for a frame. Its own `Suspense`, so only the element waits and
 * not the page around it.
 */
export const deferredPlugin = (key: string, { load, css, declaration }: DeferredPlugin): PluginComponent => {
  let code: Promise<PluginComponent> | undefined;
  const loadCode = () =>
    (code ??= Promise.all([load(), css ? loadStylesheet(css, key) : undefined]).then(([module]) => module.default));

  const standIn = (path: string[], { content, version, initialItems, plugins }: PluginDeclaration): PluginComponent => {
    const Loaded = lazy(async () => ({
      default: path.reduce(
        (component, type) => {
          const sub = component.plugins?.[type];
          if (!sub) {
            throw new Error(`[plitzi] plugin "${key}" was loaded without the "${type}" it declared`);
          }

          return sub;
        },
        await loadCode()
      )
    }));
    const Deferred: PluginComponent = props => (
      <Suspense fallback={null}>
        <Loaded {...props} />
      </Suspense>
    );
    Deferred.displayName = `Deferred(${path.at(-1) ?? key})`;

    return Object.assign(Deferred, {
      content,
      version,
      initialItems,
      plugins: plugins
        ? Object.fromEntries(Object.entries(plugins).map(([type, sub]) => [type, standIn([...path, type], sub)]))
        : undefined
    });
  };

  return standIn([], declaration);
};
