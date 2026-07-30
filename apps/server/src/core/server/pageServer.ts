import { createHttpServer } from './baseServer';
import { buildCacheManager, createServerCaches, DEFAULT_TTL_MS, destroyServerCaches } from '../../helpers/cache';
import normalizePlugins, { normalizePluginSource } from '../../helpers/normalizePlugins';
import { createMemoryDraftStore } from '../../modules/ssr/preview';
import { compileTemplate } from '../../modules/ssr/template';
import { PluginManager } from '../../plugins/manager';
import { makeHandler } from '../http/dispatcher';
import { buildPagePipeline } from '../services/registry';
import { resolveServices } from '../services/resolve';

import type { BuildContext } from '../http/dispatcher';
import type { SSRContext } from '../http/types';
import type { ResolvedServices } from '../services/resolve';
import type { CacheManager, PluginRegistry, SSRServer, SSRServerConfig } from '@plitzi/sdk-shared';

/** The page-serving machinery: html/rsc caches, the render template and the plugin manager, driving the page
 *  pipeline. Which services it mounts is the CALLER's decision — {@link createServer} passes whatever the config
 *  enables, createSSRServer pins the page surface — so this unit never second-guesses a factory's promise. */
export const createPageServer = (config: SSRServerConfig, services: ResolvedServices): SSRServer => {
  const { cacheTtlMs: htmlTtlMs = DEFAULT_TTL_MS.html } = config;
  // Draft-preview tokens need a store shared between the /preview writer and the __pt render reader; default to
  // an in-process one when the consumer injects none (single replica). Set on config so both paths see it.
  if (config.preview?.enabled && !config.draftStore) {
    config.draftStore = createMemoryDraftStore();
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

  const stages = buildPagePipeline(services);
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

/** The page server: SSR and RSC, and nothing else. MCP is pinned OFF here even when the config asks for it —
 *  what a factory named after a surface mounts must be readable from its name alone. A deployment that wants
 *  both surfaces in one process asks {@link createServer} for them; a dedicated MCP server is createMCPServer. */
export const createSSRServer = (config: SSRServerConfig): SSRServer =>
  createPageServer(config, { ...resolveServices(config), mcp: false });
