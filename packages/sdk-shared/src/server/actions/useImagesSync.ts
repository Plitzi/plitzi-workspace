import { useCommonStoreSync } from '../../store';

import type { ServerSSR } from '../../types';

/**
 * Seeds where this origin resizes remote pictures, once, at the SDK root — as `useRealtimeSync` does for channels.
 *
 * Only a server that mounts the endpoint publishes the path, so a render without one (the builder, an embed, a client
 * project) keeps every image on its own `src` rather than pointing it at a 404.
 */
const useImagesSync = (ssr?: ServerSSR) => {
  useCommonStoreSync(['images.endpoint'], [ssr?.imagePath]);
};

export default useImagesSync;
