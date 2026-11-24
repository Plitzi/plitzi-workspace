import { readsTheClock } from '@plitzi/sdk-shared/timeWindows';

import type { Schema } from '@plitzi/sdk-shared';

type SpaceTrees = Pick<Schema, 'flat'> &
  Partial<Pick<Schema, 'components'>> & { settings?: Partial<Pick<Schema['settings'], 'computed'>> };

/** Read once per space as it was read: the object is shared by every render of a revision (the offline-data cache). */
const known = new WeakMap<SpaceTrees, boolean>();

/**
 * Whether a space shows or says anything by the time — a time window, a countdown, a template on the page's clock — so
 * a page of it is drawn at an instant the browser hydrates at.
 */
export const spaceReadsTheClock = (schema: SpaceTrees): boolean => {
  const found = known.get(schema);
  if (found !== undefined) {
    return found;
  }

  const reads = readsTheClock(schema);
  known.set(schema, reads);

  return reads;
};
