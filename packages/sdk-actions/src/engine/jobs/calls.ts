import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

import type { JobQueue } from '../../types/jobs';
import type { Environment, Job, QueuedCallStatus, RunUser, SpaceRevision } from '@plitzi/sdk-shared';

/**
 * A visitor's call kept in the queue because nothing could run it then — no worker answered the page, or no runner its
 * code — to run, as theirs, as soon as something can. Only a call that never started is kept: one that started and
 * lost its runner half-way answers as it always did, so nothing it did runs twice.
 */
export type CallToKeep = {
  spaceId: number;
  environment: Environment;
  actionId: string;
  input: Record<string, unknown>;
  /** Who made it, as the session said when it was accepted: the run is theirs, with their permissions. */
  user?: RunUser;
  callerId: string;
  idempotencyKey?: string;
  origin?: string;
  at?: SpaceRevision;
};

/** How many calls one space may have waiting: past it, a call is refused, saying so, rather than piled up. */
export const KEPT_CALLS_PER_SPACE = 500;

/** How long a kept call waits at most: one no worker or runner could run within a day is not run after it. */
export const KEPT_CALL_MS = 24 * 60 * 60 * 1000;

/** How many times a kept call that started and failed is tried again — waiting for a runner is not one of them. */
const CALL_ATTEMPTS = 3;

/** A user as a job keeps them: what the run reads of them, never the session's token. */
export const runUserOf = (user: RunUser | undefined): RunUser | undefined =>
  user
    ? {
        id: user.id,
        username: user.username,
        email: user.email,
        verified: user.verified,
        permissions: user.permissions,
        roles: user.roles
      }
    : undefined;

/**
 * The job a call is kept as: named by the key the caller gave it — so a page that asks again (it retried, or asked the
 * worker and then the page server) finds the one it kept — or by nothing anyone can guess.
 */
const jobIdOf = (call: CallToKeep): string =>
  call.idempotencyKey
    ? `call:${String(call.spaceId)}:${createHash('sha256')
        .update(`${call.callerId}\0${call.actionId}\0${call.idempotencyKey}`)
        .digest('hex')
        .slice(0, 32)}`
    : `call:${String(call.spaceId)}:${randomUUID()}`;

const sameSecret = (given: string, kept: string): boolean => {
  const a = Buffer.from(given);
  const b = Buffer.from(kept);

  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Keeps a call in the queue: answered with its job and the secret its caller reads the answer with, or why it was
 * not kept. A call asked again under the same key is the one already kept — its caller's, never anybody else's.
 */
export const keepCall = async (
  queue: JobQueue,
  call: CallToKeep
): Promise<{ jobId: string; ticket: string } | { refused: string }> => {
  const jobId = jobIdOf(call);
  const kept = await queue.getJob([call.spaceId], jobId);
  if (kept) {
    const { target } = kept;
    if (target.kind !== 'action' || target.callerId !== call.callerId || !target.ticket) {
      return { refused: 'This call is already kept for somebody else' };
    }

    return { jobId, ticket: target.ticket };
  }

  const waiting = await queue.listJobs({
    spaceIds: [call.spaceId],
    status: 'pending',
    kind: 'action',
    limit: 1,
    offset: 0
  });
  if (waiting.total >= KEPT_CALLS_PER_SPACE) {
    return {
      refused: `This space has ${String(KEPT_CALLS_PER_SPACE)} calls waiting already: try again once the server is back`
    };
  }

  const ticket = randomUUID();
  const user = runUserOf(call.user);
  await queue.enqueue({
    id: jobId,
    spaceId: call.spaceId,
    environment: call.environment,
    target: {
      kind: 'action',
      name: call.actionId,
      trigger: 'call',
      callerId: call.callerId,
      ticket,
      ...(user ? { user } : {}),
      ...(call.idempotencyKey ? { idempotencyKey: call.idempotencyKey } : {}),
      ...(call.origin ? { origin: call.origin } : {}),
      ...(call.at ? { at: call.at } : {})
    },
    input: call.input,
    dueAt: Date.now(),
    maxAttempts: CALL_ATTEMPTS
  });

  return { jobId, ticket };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** What a kept call's run answered, as the job keeps it (`result`). */
export type KeptCallAnswer = {
  runId: string;
  status: 'completed' | 'failed';
  output: Record<string, unknown>;
  error?: string;
  code?: string;
  reason?: string;
};

const answerOf = (job: Job): KeptCallAnswer | undefined => {
  const { result } = job;
  if (!isRecord(result) || (result.status !== 'completed' && result.status !== 'failed')) {
    return undefined;
  }

  return {
    runId: typeof result.runId === 'string' ? result.runId : (job.runId ?? ''),
    status: result.status,
    output: isRecord(result.output) ? result.output : {},
    ...(typeof result.error === 'string' ? { error: result.error } : {}),
    ...(typeof result.code === 'string' ? { code: result.code } : {}),
    ...(typeof result.reason === 'string' ? { reason: result.reason } : {})
  };
};

/**
 * A kept call as its caller reads it, with the secret it was given: waiting, running, or what it answered. Undefined
 * for a job that is not a kept call or a secret that is not its — the same answer, so neither is told from the other.
 */
export const readKeptCall = async (
  queue: JobQueue,
  spaceId: number,
  jobId: string,
  ticket: string
): Promise<QueuedCallStatus | undefined> => {
  const job = await queue.getJob([spaceId], jobId);
  if (job?.target.kind !== 'action' || !job.target.ticket || !sameSecret(ticket, job.target.ticket)) {
    return undefined;
  }

  switch (job.status) {
    case 'pending':
    case 'paused':
      return { status: 'queued', jobId, attempts: job.attempts };
    case 'running':
      return { status: 'running', jobId, attempts: job.attempts };
    case 'succeeded': {
      const answer = answerOf(job);

      return answer ? { jobId, ...answer } : { status: 'completed', jobId, runId: job.runId ?? '', output: {} };
    }
    default: {
      const answer = answerOf(job);

      return {
        status: 'failed',
        jobId,
        runId: answer?.runId ?? job.runId ?? '',
        output: answer?.output ?? {},
        error: answer?.error ?? job.error ?? `It was ${job.status} before it could run`,
        ...(answer?.code ? { code: answer.code } : {}),
        reason: answer?.reason ?? (job.status === 'cancelled' ? 'aborted' : 'failed')
      };
    }
  }
};
