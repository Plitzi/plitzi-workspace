import type { JobSpaces } from '../types';
import type { Document } from 'mongodb';

/** What a claim with these `spaces` and `memoryMb` takes at `at`: due and waiting, of its spaces — or a job a worker died
 * running that this one may hold, whatever its spaces. */
export const claimable = (
  at: number,
  spaces: JobSpaces | undefined,
  memoryMb: number | undefined,
  withoutCode = false
): Document => ({
  status: 'pending',
  runAt: { $lte: at },
  ...(withoutCode ? { 'target.kind': 'action', 'target.code': { $ne: true } } : {}),
  $or: [
    {
      needsMemoryMb: { $exists: false },
      ...(spaces ? { spaceId: 'only' in spaces ? { $in: spaces.only } : { $nin: spaces.except } } : {})
    },
    ...(memoryMb === undefined ? [] : [{ needsMemoryMb: { $lte: memoryMb } }])
  ]
});
