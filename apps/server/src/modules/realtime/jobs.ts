import { accessRefusal } from '@plitzi/sdk-shared/actions';
import { JOB_TYPE, jobTopic } from '@plitzi/sdk-shared/realtime';

import type { RealtimeHub, RealtimeSpace } from './hub';
import type { RealtimeRetained } from './retained';
import type { ActionJob, ChannelDeclaration, FunctionJobView, SSRUser } from '@plitzi/sdk-shared';

/** How the realtime reaches a job, once the actions module hands it the way (`watchJobs`). */
export type JobLookup = (spaceId: number, jobId: string) => Promise<ActionJob | undefined>;

/** A job's topic, as a channel: the server alone says how the job goes, and a page that joins hears the latest. */
export const JOB_CHANNEL: ChannelDeclaration = { access: { mode: 'session' }, publish: 'server', retain: true };

/** How long a job's topic is kept after it last changed: as long as the queue keeps a finished job readable. */
export const JOB_RETAINED_SECONDS = 30 * 24 * 60 * 60;

/**
 * Why a page may not watch a job, or nothing when it may: whoever started it always does, and anyone else as the
 * job's `watch` says — a channel's access, read against the visitor's permissions in the space. A job of another space,
 * or none by that id, is no topic at all.
 */
export const jobRefusal = async (
  lookup: JobLookup | undefined,
  spaceId: number,
  jobId: string,
  user: SSRUser | undefined
): Promise<'undeclared' | 'unauthenticated' | 'forbidden' | undefined> => {
  const job = lookup ? await lookup(spaceId, jobId) : undefined;
  if (!job?.function) {
    return 'undeclared';
  }

  if (user && job.function.user?.id === user.id) {
    return undefined;
  }

  if (!job.function.watch) {
    return user ? 'forbidden' : 'unauthenticated';
  }

  return accessRefusal(job.function.watch, user);
};

/**
 * Says a job as it is now on its topic, kept for a page that joins later — the one way it is said, by the page server's
 * realtime and by an operator's panel in a process of its own alike.
 */
export const publishJobView = async (
  hub: Pick<RealtimeHub, 'publish'>,
  retained: RealtimeRetained,
  space: RealtimeSpace,
  jobId: string,
  view: FunctionJobView
): Promise<void> => {
  const message = {
    topic: jobTopic(jobId),
    type: JOB_TYPE,
    data: view,
    from: 'server',
    at: Date.now(),
    retained: true as const
  };
  await retained.keep(space, message, JOB_RETAINED_SECONDS);
  await hub.publish(space, message);
};
