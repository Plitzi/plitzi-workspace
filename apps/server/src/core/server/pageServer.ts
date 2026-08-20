import { createHttpServer } from './baseServer';
import { buildCacheManager, createServerCaches, DEFAULT_TTL_MS, destroyServerCaches } from '../../helpers/cache';
import normalizePlugins, { normalizePluginSource } from '../../helpers/normalizePlugins';
import { createActionsModule } from '../../modules/actions';
import { invalidatePluginComponentCache } from '../../modules/ssr/loadPluginComponents';
import { createMemoryDraftStore } from '../../modules/ssr/preview';
import { compileTemplate } from '../../modules/ssr/template';
import { PluginManager } from '../../plugins/manager';
import { makeHandler } from '../http/dispatcher';
import { buildPagePipeline } from '../services/registry';

import type { ActionsConfig } from '../../modules/actions';
import type { BuildContext } from '../http/dispatcher';
import type { PipelineExtensions, SSRContext } from '../http/types';
import type { ResolvedServices } from '../services/resolve';
import type { CacheManager, PluginRegistry, SSRPageServerConfig, SSRServer } from '@plitzi/sdk-shared';

/** The page-serving machinery: html/rsc caches, the render template and the plugin manager, driving the page
 *  pipeline. Which services it mounts is the CALLER's decision — {@link createServer} passes whatever the config
 *  enables — so this unit never second-guesses a factory's promise. */
export const createPageServer = (
  config: SSRPageServerConfig,
  services: ResolvedServices,
  extensions?: PipelineExtensions
): SSRServer => {
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
    // Clears every loaded component, not just this plugin's: the caches are keyed by filePath and the manager
    // maps name@version → path internally. Re-importing an already-built file is cheap; serving a stale one is not.
    invalidate: async (name?, version?) => {
      await pluginManager.invalidate(name, version);
      invalidatePluginComponentCache();
    }
  };

  // Built here rather than on first use so a malformed task set fails at BOOT, where someone is watching, instead
  // of on the first visitor's click. The lookups are typed structurally in the shared config (they answer
  // `unknown`) — this is the single seam where they become this package's own contract.
  const actions = config.action?.lookups
    ? createActionsModule({
        lookups: config.action.lookups as ActionsConfig['lookups'],
        tasks: config.action.tasks as ActionsConfig['tasks'],
        limits: config.action.limits,
        concurrency: config.action.concurrency,
        kv: config.action.kv
      })
    : undefined;

  const stages = buildPagePipeline(services, extensions);
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
      pluginManager,
      actions
    });

    return makeHandler('SSR', buildContext, stages, config.compression);
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
