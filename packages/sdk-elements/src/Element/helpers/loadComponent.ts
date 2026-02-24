import { get } from '@plitzi/plitzi-ui/helpers';

import { generatePluginModule } from './elementUtils';
import { nestedInject } from '../../Component';
import withElement from '../hocs/withElement';

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
  pluginScope: string,
  registerCallback: ComponentContextValue['register'],
  NotFoundNode: ComponentPluginWithHOC,
  autoRegister = true,
  plitziJsxSkipHOC = false
) => {
  return async () => {
    const cacheKey = `${url}::${pluginScope}`;

    // Only cache in-flight promises (dedupe concurrent loads)
    if (!remoteModuleCache.get(cacheKey)) {
      const isESM = url.endsWith('.mjs') || url.includes('.esm.') || url.includes('.module.');
      const promise = generatePluginModule(url, isESM, pluginScope).finally(() => {
        // Once resolved/rejected, free memory
        remoteModuleCache.delete(cacheKey);
      });

      remoteModuleCache.set(cacheKey, { promise, timestamp: Date.now() });
    }

    const entry = remoteModuleCache.get(cacheKey);
    const Module = await entry?.promise;
    if (!Module) {
      return { default: NotFoundNode };
    }

    const { type, pluginSettings } = get(Module, 'default', {} as ComponentPlugin);
    const { version, initialItems, plugins } = Module;

    if (!type) {
      return { default: NotFoundNode };
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
