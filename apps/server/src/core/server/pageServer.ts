import { createHttpServer } from '@plitzi/sdk-kernel/http';
import { hostable } from '@plitzi/sdk-kernel/http';
import { fleetStore } from '@plitzi/sdk-kernel/http';
import { fleetRole, resolveWorkers } from '@plitzi/sdk-kernel/http';
import { makeHandler } from '@plitzi/sdk-kernel/http';
import { configureServerLog, defaultLogLevel, isLogged, logLevelOf } from '@plitzi/sdk-kernel/log';

import { relayCache, relayPlugins } from './relay';
import { reportCacheSharing } from './reportCacheSharing';
import {
  buildCacheManager,
  cacheLimitsOf,
  createServerCaches,
  DEFAULT_TTL_MS,
  destroyServerCaches,
  shareCache
} from '../../helpers/cache';
import normalizePlugins, { normalizePluginSource } from '../../helpers/normalizePlugins';
import { reportReactBuild } from '../../helpers/reportReactBuild';
import { invalidatePluginComponentCache } from '../../modules/ssr/loadPluginComponents';
import { createMemoryDraftStore, DRAFT_STORE_METHODS } from '../../modules/ssr/preview';
import { renderLimitOf } from '../../modules/ssr/renderTurns';
import { compileTemplate } from '../../modules/ssr/template';
import { PluginManager } from '../../plugins/manager';
import { watchPluginSources } from '../../plugins/watch';
import { createRateLimit, RATE_LIMIT_METHODS } from '../auth/throttle';
import { createLivePages } from '../http/stages/livePages';
import { buildPagePipeline } from '../services/registry';

import type { CacheManager, PluginRegistry, SSRServer } from '../../types';
import type { SSRPageServerConfig } from '../../types';
import type { PipelineExtensions, SSRContext } from '../http/pageContext';
import type { ResolvedServices } from '../services/resolve';
import type { PageEngine } from '@plitzi/sdk-kernel/engine';
import type { BuildContext } from '@plitzi/sdk-kernel/http';
import type { DraftStore } from '@plitzi/sdk-shared';

/** The page-serving machinery: html/rsc caches, the render template and the plugin manager, driving the page
 *  pipeline. Which services it mounts is the CALLER's decision — {@link createServer} passes whatever the config
 *  enables — so this unit never second-guesses a factory's promise. */
export const createPageServer = (
  config: SSRPageServerConfig,
  services: ResolvedServices,
  extensions?: PipelineExtensions,
  engine?: PageEngine
): SSRServer => {
  const { cacheTtlMs: htmlTtlMs = DEFAULT_TTL_MS.html } = config;
  // One threshold for everything this server says — its requests, its runs, and the server's own messages — decided
  // here once, so no emitter needs to know it: the logger it calls already drops what is below it.
  const logLevel = config.logLevel ?? defaultLogLevel(config.devMode);
  const { logger } = config;
  config.logLevel = logLevel;
  if (logger) {
    config.logger = event => {
      if (isLogged(logLevel, logLevelOf(event))) {
        logger(event);
      }
    };
  }

  configureServerLog({
    level: logLevel,
    logger,
    ...(config.slowRunMs === undefined ? {} : { slowRunMs: config.slowRunMs })
  });
  reportReactBuild(config.devMode);
  // Draft-preview tokens need a store shared between the /preview writer and the __pt render reader; default to
  // an in-process one when the consumer injects none — the primary's, when workers serve, since the draft is written
  // through one of them and read back by whichever serves the render. Set on config so both paths see it.
  if (config.preview?.enabled && !config.draftStore) {
    config.draftStore = fleetStore<DraftStore>('ssr.drafts', DRAFT_STORE_METHODS) ?? createMemoryDraftStore();
  }

  // Resolved once — the config, else the environment, else the default — and set on the config, where the render and
  // the boot report read it.
  config.cache = { ...config.cache, ...cacheLimitsOf(config) };
  config.renderLimit = renderLimitOf(config.renderLimit);
  const caches = createServerCaches({
    htmlTtlMs,
    rscTtlMs: config.rsc?.cacheTtlMs ?? DEFAULT_TTL_MS.rsc,
    htmlBytes: config.cache.maxBytes,
    staleMs: config.cache.staleMs
  });
  const local: CacheManager | null = caches.html || caches.rsc ? buildCacheManager(caches) : null;
  const { bus, store } = config.cache;
  const shared = local && (bus || store) ? shareCache(local, { bus, store }) : undefined;
  const cache = shared?.cache ?? local;
  const role = fleetRole(resolveWorkers(config.workers));
  if (role !== 'worker' && caches.html) {
    reportCacheSharing(config, { ttlMs: htmlTtlMs, bus: Boolean(bus), store: Boolean(store) });
  }
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
    unregister: name => {
      pluginManager.unregister(name);
      invalidatePluginComponentCache();
    },
    // Clears every loaded component, not just this plugin's: the caches are keyed by filePath and the manager
    // maps name@version → path internally. Re-importing an already-built file is cheap; serving a stale one is not.
    invalidate: async (name?, version?) => {
      await pluginManager.invalidate(name, version);
      invalidatePluginComponentCache();
    }
  };

  // Resolved here rather than on first use so a malformed task set fails at BOOT, where someone is watching,
  // instead of on the first visitor's click. Shared with the RSC adapter, which needs the same one.

  const livePages = config.livePages ? createLivePages() : undefined;
  /**
   * A plugin whose source changed is built again and handed to the open pages, which swap it where it is drawn — the
   * rest of the page, its state included, stays as it was. Only while developing (`devMode`) with `livePages` on: nobody edits a
   * deployment's plugins under it, and a page that does not listen has nothing to swap.
   */
  const stopWatchingPlugins =
    livePages && config.devMode
      ? watchPluginSources(pluginManager, key => {
          invalidatePluginComponentCache();
          void pluginManager.rebuild(key).then(entry => {
            if (entry?.js) {
              livePages.plugin(entry);
            }
          });
        })
      : undefined;
  // First: a page listening for what changes under it asks before anything else is looked at, and holds its connection.
  const stages = [...(livePages ? [livePages.stage] : []), ...buildPagePipeline(services, extensions, engine)];
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
      ...(engine ? { engine } : {})
    });

    return makeHandler('SSR', buildContext, stages, {
      compression: config.compression,
      // The addresses that switch protocols are the engine's: a page's realtime connection, asking for a WebSocket.
      ...(engine?.upgrades ? { upgrades: engine.upgrades } : {})
    });
  };

  const server = createHttpServer(config, makeHandlerForPort, {
    label: 'SSR',
    // Only once the transport is bound: a server that was built and never listened on must not be claiming jobs
    // another replica could be running. With workers, only the one that carries the fleet's jobs starts them.
    onListen: () => {
      engine?.listening?.();
    },
    beforeFork: () => pluginManager.prepareAll(),
    // What the primary keeps for its workers: the engine's, a preview's drafts, the sign-in throttle.
    fleetStores: {
      ...engine?.fleetStores,
      'ssr.drafts': hostable(createMemoryDraftStore, DRAFT_STORE_METHODS),
      'auth.rateLimit': hostable(() => ({ check: createRateLimit() }), RATE_LIMIT_METHODS)
    },
    // Every realtime connection told to go the moment the server stops taking new ones: an open socket or stream never
    // ends on its own, and would hold the shutdown until the grace cut it.
    // Told to stop, it takes no new job before it announces it is going.
    onStopping: () => {
      engine?.stopping?.();
    },
    onClosing: () => {
      engine?.closing?.();
      stopWatchingPlugins?.();
      livePages?.close();
    },
    onDestroy: async () => {
      // Awaited first, and before the sockets go: the jobs running here are finished rather than abandoned, so a
      // rolling deploy costs no retries. Nothing else is waited for — what is still pending stays in the shared
      // queue, for whichever replica is running next.
      await engine?.destroy?.();
      await shared?.close();
      destroyServerCaches(caches);
      pluginManager.destroy();
    }
  });
  const { channel } = server;

  return {
    listen: server.listen,
    close: server.close,
    // What one process is told about its caches or its plugins reaches the fleet's others. Every process hears the bus
    // itself, the workers of this host among them: relaying the cache between them too would only say each
    // invalidation twice.
    cache: channel && cache && !bus ? relayCache(cache, `${channel}.cache`) : cache,
    plugins: channel
      ? relayPlugins(
          plugins,
          (name, version) => {
            pluginManager.forget(name, version);
            invalidatePluginComponentCache();
          },
          `${channel}.plugins`,
          'SSR'
        )
      : plugins,
    reloadPages: livePages?.reload ?? (() => undefined),
    updatePages: livePages?.update ?? (() => 0),
    functions: {
      setPlugin: (plugin: string, definition: unknown) => {
        if (!engine?.setPluginFunctions) {
          throw new Error(
            `[SSR] This server runs no actions (\`createPlatform\` composes them), so no plugin's functions: "${plugin}"`
          );
        }

        engine.setPluginFunctions(plugin, definition);
      }
    }
  };
};
