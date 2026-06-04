// Memoizes `path.split('.')` so a dotted path is parsed once even when it's read and written many times (a setState
// touches the same path three times: equality check, the immutable write, and the change notification). The cache
// is bounded with FIFO eviction so dynamic paths (e.g. per-id) can't grow it without limit. The returned arrays are
// treated as read-only by callers, so sharing the cached instance is safe.
const cache = new Map<string, string[]>();
const MAX_ENTRIES = 512;

const parsePath = (path: string): string[] => {
  let segments = cache.get(path);
  if (segments === undefined) {
    segments = path.split('.');
    if (cache.size >= MAX_ENTRIES) {
      cache.delete(cache.keys().next().value as string);
    }

    cache.set(path, segments);
  }

  return segments;
};

export default parsePath;
