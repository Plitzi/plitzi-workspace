/**
 * Results kept by the text they were made from, the least recently asked dropped once the texts kept pass `maxChars`.
 * What the Markdown of a page is made into is the same on every render of it — on the server, every visit — and making
 * it again was most of what a page of prose cost: kept here by its source, and bounded by what the sources weigh.
 */
export type KeptByText<T> = { get: (key: string) => T | undefined; set: (key: string, value: T) => void };

export const keptByText = <T>(maxChars: number): KeptByText<T> => {
  const kept = new Map<string, T>();
  let chars = 0;

  return {
    get: key => {
      const value = kept.get(key);
      if (value !== undefined) {
        kept.delete(key);
        kept.set(key, value);
      }

      return value;
    },
    set: (key, value) => {
      if (key.length > maxChars) {
        return;
      }

      if (kept.delete(key)) {
        chars -= key.length;
      }

      kept.set(key, value);
      chars += key.length;
      for (const oldest of kept.keys()) {
        if (chars <= maxChars) {
          break;
        }

        kept.delete(oldest);
        chars -= oldest.length;
      }
    }
  };
};
