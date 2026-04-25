import { makeHandler } from './requestHandler';
import { buildTransport, protoLabel } from './transports';
import { buildCacheManager, createServerCaches, DEFAULT_TTL_MS, destroyServerCaches } from '../helpers/cache';
import normalizePlugins, { normalizePluginSource } from '../helpers/normalizePlugins';
import { compileTemplate } from '../modules/ssr/template';
import { PluginManager } from '../plugins/manager';

import type { CacheManager, PluginRegistry, SSRServer, SSRServerConfig } from '@plitzi/sdk-shared';

export const createSSRServer = (config: SSRServerConfig): SSRServer => {
  const { httpVersion: version = 2, cacheTtlMs: htmlTtlMs = DEFAULT_TTL_MS.html } = config;
  if (version >= 3 && !config.tls) {
    throw new Error(`[SSR] httpVersion: ${version} requires a tls config with key and cert`);
  }

  const caches = createServerCaches(htmlTtlMs, config.rsc?.cacheTtlMs ?? DEFAULT_TTL_MS.rsc);
  const cache: CacheManager | null = caches.html ? buildCacheManager(caches.html) : null;
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
      const handler = makeHandler(config, port, renderFn, caches, pluginManager);
      ({ primary, h3 } = buildTransport(config, handler, port));
      primary.listen(port, host, () => {
        console.log(`[SSR] ${protoLabel(version, !!config.tls)} - listening on ${host}:${port}`);
      });
    },
    async close() {
      destroyServerCaches(caches);
      pluginManager.destroy();
      const closeOne = (srv: typeof primary) =>
        new Promise<void>((resolve, reject) => {
          srv.close(err => (err ? reject(err) : resolve()));
        });

      await Promise.all([closeOne(primary), ...(h3 ? [closeOne(h3)] : [])]);
    }
  };
};
