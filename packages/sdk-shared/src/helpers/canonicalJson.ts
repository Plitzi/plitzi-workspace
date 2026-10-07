import { isRecord } from './isRecord';

/**
 * A value as JSON with every object's keys in order, so two values that say the same thing in another order read the
 * same: what a before-and-after comparison is made with, where a key moved is not a change. `undefined` reads
 * `undefined`.
 */
export const canonicalJson = (value: unknown): string =>
  value === undefined
    ? 'undefined'
    : JSON.stringify(value, (_key, inner: unknown) =>
        isRecord(inner)
          ? Object.fromEntries(
              Object.keys(inner)
                .toSorted()
                .map(key => [key, inner[key]])
            )
          : inner
      );
