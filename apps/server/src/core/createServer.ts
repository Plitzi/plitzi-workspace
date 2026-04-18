import { makeHandler } from './requestHandler';
import { buildTransport, protoLabel } from './transports';
import { TtlCache } from '../helpers/ttlCache';
import { PluginManager } from '../plugins/manager';
import { compileTemplate } from '../ssr/template';

import type { CacheFilter, CacheManager, PluginRegistry, SSRServerConfig } from '../types';

export type SSRServer = {
  listen: (port: number, host?: string) => void;
  close: () => Promise<void>;
  readonly cache: CacheManager | null;
  readonly plugins: PluginRegistry;
};

const buildCacheManager = (store: TtlCache<string>): CacheManager => ({
  invalidate(filter?: CacheFilter): number {
    if (!filter || Object.keys(filter).length === 0) {
      const count = store.size;
      store.clear();
      return count;
    }
    return store.invalidateWhere(key => {
      const [keySpaceId, keyEnvironment, , keyHostname] = key.split('\0');
      if (filter.spaceId !== undefined && keySpaceId !== String(filter.spaceId)) {
        return false;
      }
      if (filter.environment !== undefined && keyEnvironment !== filter.environment) {
        return false;
      }
      if (filter.hostname !== undefined && keyHostname !== filter.hostname) {
        return false;
      }
      return true;
    });
  },
  clear() {
    store.clear();
  },
  get size() {
    return store.size;
  }
});

export const createSSRServer = (config: SSRServerConfig): SSRServer => {
  const version = config.httpVersion ?? 2;

  if (version >= 2 && !config.tls) {
    throw new Error(`[SSR] httpVersion: ${version} requires a tls config with key and cert`);
  }

  const ttlMs = config.cacheTtlMs ?? 5 * 60 * 1000;
  const cacheStore = ttlMs !== 0 ? new TtlCache<string>(ttlMs) : undefined;
  const cache: CacheManager | null = cacheStore ? buildCacheManager(cacheStore) : null;
  const renderFn = config.templateFn ?? compileTemplate();

  const pluginManager = new PluginManager(config.plugins ?? {}, config.pluginsCacheDir, config.pluginsTtlMs);

  const plugins: PluginRegistry = {
    register: (name, source) => pluginManager.register(name, source),
    invalidate: (name?) => pluginManager.invalidate(name)
  };

  let primary: ReturnType<typeof buildTransport>['primary'];
  let h3: ReturnType<typeof buildTransport>['h3'];

  return {
    cache,
    plugins,
    listen(port: number, host = '0.0.0.0') {
      const handler = makeHandler(config, port, renderFn, cacheStore, pluginManager);
      ({ primary, h3 } = buildTransport(config, handler, port));
      primary.listen(port, host, () => {
        console.log(`[SSR] ${protoLabel(version, !!config.tls)} listening on ${host}:${port}`);
      });
    },
    async close() {
      cacheStore?.destroy();
      pluginManager.destroy();
      const closeOne = (srv: typeof primary) =>
        new Promise<void>((resolve, reject) => {
          srv.close(err => (err ? reject(err) : resolve()));
        });

      await Promise.all([closeOne(primary), ...(h3 ? [closeOne(h3)] : [])]);
    }
  };
};
