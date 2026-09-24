import { broadcast, onBroadcast } from './link';
import { serverLog } from '../../../helpers/serverLog';

import type { CacheFilter, CacheManager, PluginAction, PluginRegistry, PluginSourceFile } from '@plitzi/sdk-shared';

/**
 * `server.cache` and `server.plugins` in a fleet, whose workers each keep their own: what one process is told, every
 * other hears. A single server's are handed back unwrapped (`baseServer.ts`). The call that matters is the one that lands on a random worker — a publish webhook, a
 * `/revalidate` endpoint — and without this it would clear one worker's pages and leave the rest serving the old
 * ones until their TTL ran out.
 *
 * Code that runs in every process (a pub/sub subscription made where the server is created) is told N times; what
 * is relayed is safe to apply again, and cheap: it only drops entries from memory.
 */

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const PLUGIN_ACTIONS: readonly PluginAction[] = ['copy', 'compile', 'download', 'cdn'];
const isPluginAction = (value: unknown): value is PluginAction => PLUGIN_ACTIONS.some(action => action === value);

const cacheFilterOf = (value: unknown): CacheFilter => {
  if (!isRecord(value)) {
    return {};
  }

  return {
    ...(typeof value.spaceId === 'number' ? { spaceId: value.spaceId } : {}),
    ...(typeof value.environment === 'string' ? { environment: value.environment } : {}),
    ...(typeof value.hostname === 'string' ? { hostname: value.hostname } : {})
  };
};

/** `invalidate` answers, and `size` counts, this process's entries: the others answer nothing back. */
export const relayCache = (cache: CacheManager, channel: string): CacheManager => {
  onBroadcast(channel, payload => {
    if (!isRecord(payload)) {
      return;
    }

    if (payload.op === 'clear') {
      cache.clear();
    } else if (payload.op === 'invalidate') {
      cache.invalidate(cacheFilterOf(payload.filter));
    }
  });

  return {
    invalidate: filter => {
      const count = cache.invalidate(filter);
      broadcast(channel, { op: 'invalidate', filter: filter ?? {} });

      return count;
    },
    clear: () => {
      cache.clear();
      broadcast(channel, { op: 'clear' });
    },
    get size() {
      return cache.size;
    }
  };
};

const pluginSourceOf = (value: unknown): PluginSourceFile | undefined => {
  if (!isRecord(value) || typeof value.js !== 'string') {
    return undefined;
  }

  return {
    js: value.js,
    ...(typeof value.css === 'string' ? { css: value.css } : {}),
    ...(typeof value.version === 'string' ? { version: value.version } : {}),
    ...(isPluginAction(value.action) ? { action: value.action } : {}),
    ...(isRecord(value.props) ? { props: value.props } : {})
  };
};

const optionalString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/**
 * A plugin registered or invalidated in one process is registered or forgotten in all of them. The files are
 * shared — the process that invalidated removed them — so the others only drop what they remember (`forget`).
 *
 * A plugin registered with a `component` cannot be sent: a function does not cross between processes. It is
 * registered where it was called, and said so, rather than silently missing from the other workers.
 */
export const relayPlugins = (
  plugins: PluginRegistry,
  forget: (name?: string, version?: string) => void,
  channel: string,
  label: string
): PluginRegistry => {
  onBroadcast(channel, payload => {
    if (!isRecord(payload)) {
      return;
    }

    if (payload.op === 'register' && typeof payload.name === 'string') {
      const source = pluginSourceOf(payload.source);
      if (source) {
        plugins.register(payload.name, source);
      }
    } else if (payload.op === 'forget') {
      forget(optionalString(payload.name), optionalString(payload.version));
    }
  });

  return {
    register: (name, source) => {
      plugins.register(name, source);
      if ('component' in source) {
        serverLog.warn(
          label,
          `plugin "${name}" is a component: only this process has it. Register component plugins where the ` +
            'server is created, so every worker does.'
        );

        return;
      }

      broadcast(channel, { op: 'register', name, source });
    },
    invalidate: async (name, version) => {
      await plugins.invalidate(name, version);
      broadcast(channel, { op: 'forget', name, version });
    }
  };
};
