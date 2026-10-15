import { isRecord } from '../helpers/isRecord';

import type { SpaceActivity, SpaceActivityPage } from './types';

const isActivity = (value: unknown): value is SpaceActivity => {
  if (!isRecord(value) || typeof value.at !== 'number') {
    return false;
  }

  switch (value.kind) {
    case 'change':
      return (
        typeof value.seq === 'number' &&
        typeof value.summary === 'string' &&
        typeof value.origin === 'string' &&
        isRecord(value.author) &&
        Array.isArray(value.touched)
      );
    case 'publish':
      return typeof value.message === 'string' && isRecord(value.author);
    case 'action':
      return typeof value.actionId === 'string' && typeof value.status === 'string';
    default:
      return false;
  }
};

/**
 * Whether a reply is a page of activity — what a client checks the platform's answer against before reading it, an
 * answer from a server of another version included.
 */
export const isSpaceActivityPage = (value: unknown): value is SpaceActivityPage =>
  isRecord(value) &&
  Array.isArray(value.activity) &&
  value.activity.every(isActivity) &&
  typeof value.cursor === 'string' &&
  typeof value.more === 'boolean' &&
  typeof value.waitedMs === 'number' &&
  typeof value.skippedMine === 'number';
