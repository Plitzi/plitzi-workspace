import { useCommonStoreSync } from '../../store';

import type { ServerSSR } from '../../types';

/**
 * Seeds where this origin's realtime channels answer, once, at the SDK root — as `useActionsSync` does for actions.
 *
 * Only a server that mounts the endpoint publishes the path, so a render without one (the builder, an embed, an
 * offline widget) leaves every `channel` closed rather than reconnecting forever to a 404.
 */
const useRealtimeSync = (ssr?: ServerSSR) => {
  useCommonStoreSync(['realtime.endpoint', 'realtime.transport'], [ssr?.realtimePath, ssr?.realtimeTransport]);
};

export default useRealtimeSync;
