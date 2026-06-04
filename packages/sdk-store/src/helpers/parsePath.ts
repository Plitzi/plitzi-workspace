// Memoizes `path.split('.')` (a single setState parses the same path several times). FIFO-bounded so dynamic
// per-id paths can't grow it without limit. Callers treat the returned array as read-only.
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
