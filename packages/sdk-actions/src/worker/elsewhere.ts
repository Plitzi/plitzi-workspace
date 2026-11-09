import { DEFAULT_REALTIME_PATH, DEFAULT_REALTIME_TRANSPORT } from '../realtime';
import { actionOriginProblem, publishedActionEndpoint } from './origin';
import { createRemoteRenderResolver } from '../render/remote';

import type { RemoteRenderOptions } from '../render/remote';
import type { EngineConfig } from '../types';
import type { PageEngine } from '@plitzi/sdk-kernel/engine';

/**
 * What a page server is handed when its actions run on a worker (`createWorker`): where its pages call them and where
 * their channels are, and nothing that runs here — the gateway sends those paths to the worker. Give it the `action` and
 * `realtime` the worker has, for the same paths — and, when the worker is on another origin, its `action.origin`: the pages
 * are told the address there.
 *
 * With `render` its server elements that name an action or a connector are asked of the worker too (`/_render`, behind
 * the worker's `render.secret`): this server then runs no action at all. Without it, a page that renders one shows it
 * in its error state, said as an element no engine here resolves.
 */
export const engineOnWorker = ({
  action,
  realtime,
  render
}: Pick<EngineConfig, 'action' | 'realtime'> & { render?: RemoteRenderOptions } = {}): PageEngine => {
  const problem = actionOriginProblem(action, 'pages');
  if (problem) {
    throw new Error(problem);
  }

  return {
    endpoints: [],
    routes: [],
    ...(render ? { resolveElement: createRemoteRenderResolver(render) } : {}),
    published: {
      actionPath: publishedActionEndpoint(action),
      ...(realtime === false
        ? {}
        : {
            realtimePath: realtime?.path ?? DEFAULT_REALTIME_PATH,
            realtimeTransport: realtime?.transport ?? DEFAULT_REALTIME_TRANSPORT
          })
    }
  };
};
