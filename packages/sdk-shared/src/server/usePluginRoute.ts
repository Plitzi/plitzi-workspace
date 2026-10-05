import { useCallback } from 'react';

import { pluginRoutePath } from '../actions/functions';
import { useCommonStore } from '../store';

/**
 * Where a plugin's own server half answers, for its component: `route('/layout')` is the URL of the plugin's
 * `GET /layout`, served under `/fn/plugins/<type>/` by the server this page came from — with no flow, no server action
 * and nothing for the space to wire.
 *
 * ```tsx
 * const route = usePluginRoute('board');
 * const url = route('/layout');
 * if (url) {
 *   await fetch(url, { method: 'POST', body: JSON.stringify(layout), credentials: 'same-origin' });
 * }
 * ```
 *
 * `undefined` while the page is served without a server that runs code — the builder's canvas, an embed, an offline
 * render — the same answer that leaves a `runServerAction` step inert there, rather than a request to a guaranteed 404.
 */
const usePluginRoute = (plugin: string) => {
  // Published by a server that mounts actions, which is also the one that answers the functions' routes.
  const [endpoint] = useCommonStore('actions.endpoint');

  return useCallback(
    (path = '/'): string | undefined => {
      if (!endpoint) {
        return undefined;
      }

      const route = pluginRoutePath(plugin, path);

      return typeof window === 'undefined' ? route : new URL(route, new URL(endpoint, window.location.href)).href;
    },
    [endpoint, plugin]
  );
};

export default usePluginRoute;
