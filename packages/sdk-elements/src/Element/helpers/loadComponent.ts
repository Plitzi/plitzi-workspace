import { get } from '@plitzi/plitzi-ui/helpers';

import { generatePluginModule } from './elementUtils';

import type { PlitziModule } from './elementUtils';
import type { ComponentContextValue, ComponentPlugin, ComponentPluginWithHOC } from '@plitzi/sdk-shared';

// Cache only in-flight remote module loads (dedupe concurrent requests)
type RemoteCacheEntry = {
  promise: Promise<PlitziModule | undefined>;
  version?: string;
  timestamp: number;
};

const remoteModuleCache = new Map<string, RemoteCacheEntry>();

/**
 * A remote plugin's component, loaded from its module — the one of `type` when the element is not the plugin's main
 * one. A plugin packs several elements into one module (the main as `default`, the others under `plugins`), and every
 * element of it is loaded from the same URL: handing each the main component rendered the main element in all of them.
 */
const loadComponent = (
  url: string,
  registerCallback: ComponentContextValue['register'],
  autoRegister = true,
  plitziJsxSkipHOC = false,
  type?: string
) => {
  return async () => {
    // Only cache in-flight promises (dedupe concurrent loads)
    if (!remoteModuleCache.get(url)) {
      const promise = generatePluginModule(url).finally(() => {
        // Once resolved/rejected, free memory
        remoteModuleCache.delete(url);
      });

      remoteModuleCache.set(url, { promise, timestamp: Date.now() });
    }

    const entry = remoteModuleCache.get(url);
    const Module = await entry?.promise;
    /**
     * Every module the load hands back is imported here, not at the top.
     *
     * `withElement` reaches this file statically (withElement → useInternalItems → pluginSelector → PluginRemote), and
     * each of these three imports `withElement` back. A static edge closes that cycle, and a bundler is then free to
     * evaluate `NotFound`'s top-level `withElement(NotFound)` before `withElement` exists — which the minified SDK did,
     * and failed to load at all. Nothing here is needed before a plugin has been fetched.
     */
    const [{ default: withElement }, { default: NotFound }, { nestedInject }] = await Promise.all([
      import('../hocs/withElement'),
      import('../../elements/internal/NotFound/NotFound'),
      import('../../Component/ComponentHelper')
    ]);
    if (!Module) {
      return { default: NotFound as ComponentPluginWithHOC };
    }

    const { type: mainType, pluginSettings } = get(Module, 'default', {} as ComponentPlugin);
    const { version, initialItems, plugins } = Module;

    if (!mainType) {
      return { default: NotFound as ComponentPluginWithHOC };
    }

    let plitziComponent: ComponentPlugin | ComponentPluginWithHOC = Module.default;
    if (!plitziJsxSkipHOC) {
      plitziComponent = withElement(Module.default) as ComponentPluginWithHOC;
    }

    plitziComponent.version = version;
    plitziComponent.origin = 'remote';
    plitziComponent.type = mainType;
    plitziComponent.initialItems = initialItems;
    plitziComponent.pluginSettings = pluginSettings;
    plitziComponent.plugins = nestedInject(plugins, 'remote');
    if (autoRegister) {
      registerCallback(plitziComponent);
    }

    if (!type || type === mainType) {
      return { default: plitziComponent };
    }

    const element = plitziJsxSkipHOC ? plugins?.[type] : plitziComponent.plugins[type];

    return { default: (element ?? NotFound) as ComponentPluginWithHOC };
  };
};

export default loadComponent;
