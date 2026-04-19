import type { CacheManager, CacheFilter } from '../types';
import type { TtlCache } from './ttlCache';

const buildCacheManager = (store: TtlCache<string>): CacheManager => ({
  invalidate(filter?: CacheFilter): number {
    if (!filter || Object.keys(filter).length === 0) {
      const count = store.size;
      store.clear();

      return count;
    }

    return store.invalidateWhere(key => {
      const [keySpaceId, keyEnvironment, , keyHostname] = key.split('\0');
      if (filter.spaceId !== undefined && keySpaceId !== String(filter.spaceId)) {
        return false;
      }

      if (filter.environment !== undefined && keyEnvironment !== filter.environment) {
        return false;
      }

      if (filter.hostname !== undefined && keyHostname !== filter.hostname) {
        return false;
      }

      return true;
    });
  },
  clear() {
    store.clear();
  },
  get size() {
    return store.size;
  }
});

export default buildCacheManager;
