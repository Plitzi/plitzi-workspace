import { makeHandler } from './requestHandler';
import { buildTransport, protoLabel } from './transports';
import buildCacheManager from '../helpers/buildCacheManager';
import normalizePlugins, { normalizePluginSource } from '../helpers/normalizePlugins';
import { DEFAULT_CACHE_TTL_MS, TtlCache } from '../helpers/ttlCache';
import { PluginManager } from '../plugins/manager';
import { compileTemplate } from '../ssr/template';

import type { CacheManager, PluginRegistry, SSRServer, SSRServerConfig } from '../types';

export const createSSRServer = (config: SSRServerConfig): SSRServer => {
  const { httpVersion: version = 2, cacheTtlMs: ttlMs = DEFAULT_CACHE_TTL_MS } = config;
  if (version >= 3 && !config.tls) {
    throw new Error(`[SSR] httpVersion: ${version} requires a tls config with key and cert`);
  }

  const cacheStore = ttlMs !== 0 ? new TtlCache<string>(ttlMs) : undefined;
  const cache: CacheManager | null = cacheStore ? buildCacheManager(cacheStore) : null;
  const renderFn = config.templateFn ?? compileTemplate();

  const pluginManager = new PluginManager(
    normalizePlugins(config.plugins ?? {}),
    config.pluginsCacheDir,
    config.pluginsTtlMs,
    config.devMode
  );

  const plugins: PluginRegistry = {
    register: (name, source) => {
      const normalized = normalizePluginSource(source);
      pluginManager.register(`${name}@${normalized.version}`, normalized);
    },
    invalidate: (name?, version?) => pluginManager.invalidate(name, version)
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
