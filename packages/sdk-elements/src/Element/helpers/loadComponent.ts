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

const loadComponent = (
  url: string,
  registerCallback: ComponentContextValue['register'],
  autoRegister = true,
  plitziJsxSkipHOC = false
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

    const { type, pluginSettings } = get(Module, 'default', {} as ComponentPlugin);
    const { version, initialItems, plugins } = Module;

    if (!type) {
      return { default: NotFound as ComponentPluginWithHOC };
    }

    let plitziComponent: ComponentPlugin | ComponentPluginWithHOC = Module.default;
    if (!plitziJsxSkipHOC) {
      plitziComponent = withElement(Module.default) as ComponentPluginWithHOC;
    }

    plitziComponent.version = version;
    plitziComponent.origin = 'remote';
    plitziComponent.type = type;
    plitziComponent.initialItems = initialItems;
    plitziComponent.pluginSettings = pluginSettings;
    plitziComponent.plugins = nestedInject(plugins, 'remote');
    if (autoRegister) {
      registerCallback(plitziComponent);
    }

    return { default: plitziComponent };
  };
};

export default loadComponent;
