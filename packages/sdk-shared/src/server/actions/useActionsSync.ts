import { useCommonStoreSync } from '../../store';

import type { ServerSSR } from '../../types';

/**
 * Seeds where this origin runs server actions, once, at the SDK root.
 *
 * The same shape as `useRscSync` and for the same reason: only a server that mounts the endpoint publishes the
 * path, so a client-only render — an embed, the builder, an offline widget — leaves every `serverAction` step
 * inert rather than posting to a guaranteed 404 against whatever origin the page happens to live on.
 */
const useActionsSync = (ssr?: ServerSSR) => {
  useCommonStoreSync(['actions.endpoint'], [ssr?.actionPath]);
};

export default useActionsSync;
