import { get } from '@plitzi/plitzi-ui/helpers';

import { generatePluginModule } from './elementUtils';
import { nestedInject } from '../../Component/ComponentHelper';
import NotFound from '../../elements/internal/NotFound/NotFound';
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
