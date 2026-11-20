import { hasTimeWindows } from '@plitzi/sdk-shared/timeWindows';

import type { Schema } from '@plitzi/sdk-shared';

type SpaceTrees = Pick<Schema, 'flat'> & Partial<Pick<Schema, 'components'>>;

/** Read once per space as it was read: the object is shared by every render of a revision (the offline-data cache). */
const known = new WeakMap<SpaceTrees, boolean>();

/** Whether a space shows things by the time — a page of it is drawn at an instant the browser hydrates at. */
export const spaceTimeWindows = (schema: SpaceTrees): boolean => {
  const found = known.get(schema);
  if (found !== undefined) {
    return found;
  }

  const has = hasTimeWindows(schema);
  known.set(schema, has);

  return has;
};
