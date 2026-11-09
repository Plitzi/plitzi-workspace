import type { JobSpaces, JobTake } from '../types';
import type { Document } from 'mongodb';

/** What each kind of work is, as a filter (`JobTake`, `queueRules`' `takeOf`). */
const TAKES: Record<JobTake, Document> = {
  light: { 'target.kind': 'action', 'target.code': { $ne: true } },
  codeActions: { 'target.kind': 'action', 'target.code': true },
  functionJobs: { 'target.kind': 'function' }
};

/** What a claim with these `spaces` and `memoryMb` takes at `at`: due and waiting, of its spaces — or a job a worker died
 * running that this one may hold, whatever its spaces. */
export const claimable = (
  at: number,
  spaces: JobSpaces | undefined,
  memoryMb: number | undefined,
  takes?: JobTake
): Document => ({
  status: 'pending',
  runAt: { $lte: at },
  ...(takes ? TAKES[takes] : {}),
  $or: [
    {
      needsMemoryMb: { $exists: false },
      ...(spaces ? { spaceId: 'only' in spaces ? { $in: spaces.only } : { $nin: spaces.except } } : {})
    },
    ...(memoryMb === undefined ? [] : [{ needsMemoryMb: { $lte: memoryMb } }])
  ]
});
