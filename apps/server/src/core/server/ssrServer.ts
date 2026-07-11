import { createHttpServer } from './baseServer';
import { buildCacheManager, createServerCaches, DEFAULT_TTL_MS, destroyServerCaches } from '../../helpers/cache';
import normalizePlugins, { normalizePluginSource } from '../../helpers/normalizePlugins';
import { createMemoryDraftStore } from '../../modules/ssr/preview';
import { compileTemplate } from '../../modules/ssr/template';
import { PluginManager } from '../../plugins/manager';
import { makeHandler } from '../http/dispatcher';
import { buildSSRPipeline } from '../services/registry';
import { resolveServices } from '../services/resolve';

import type { BuildContext } from '../http/dispatcher';
import type { SSRContext } from '../http/types';
import type { CacheManager, PluginRegistry, SSRServer, SSRServerConfig } from '@plitzi/sdk-shared';

// All-in-one page server: html/rsc caches, the render template and the plugin manager, driving the full
// pipeline. Mounts whatever the config/adapters enable — ssr on, rsc/mcp from their signals.
export const createSSRServer = (config: SSRServerConfig): SSRServer => {
  const { cacheTtlMs: htmlTtlMs = DEFAULT_TTL_MS.html } = config;
  // Draft-preview tokens need a store shared between the /preview writer and the __pt render reader; default to
  // an in-process one when the consumer injects none (single replica). Set on config so both paths see it.
  if (config.preview?.enabled && !config.draftStore) {
    config.draftStore = createMemoryDraftStore();
  }

  const services = resolveServices(config);
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

  const stages = buildSSRPipeline(services);
  const makeHandlerForPort = (port: number) => {
    const buildContext: BuildContext<SSRContext> = (raw, rawRes, req, res) => ({
      raw,
      rawRes,
      req,
      res,
      config,
      port,
      renderFn,
      caches,
      pluginManager
    });

    return makeHandler('SSR', buildContext, stages);
  };

  return createHttpServer(config, makeHandlerForPort, {
    label: 'SSR',
    cache,
    plugins,
    onDestroy: () => {
      destroyServerCaches(caches);
      pluginManager.destroy();
    }
  });
};
