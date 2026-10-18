import { describe, expect, it } from 'vitest';

import { jobRefusal } from './jobs';

import type { JobLookup } from './jobs';
import type { ActionJob, SSRUser } from '@plitzi/sdk-shared';

const job = (over: Partial<ActionJob> = {}): ActionJob => ({
  id: 'job:1:a',
  spaceId: 1,
  actionId: 'train',
  environment: 'main',
  trigger: 'job',
  input: {},
  dueAt: 0,
  maxAttempts: 3,
  status: 'running',
  runAt: 0,
  attempts: 1,
  createdAt: 0,
  updatedAt: 0,
  history: [],
  function: {
    user: { id: 3, username: 'ana', email: 'ana@example.test', verified: true, permissions: [], roles: [] }
  },
  ...over
});

const visitor = (id: number, permissions: string[] = []): SSRUser => ({
  token: 'session',
  id,
  username: `user-${String(id)}`,
  email: `user-${String(id)}@example.test`,
  verified: true,
  permissions,
  roles: []
});

const lookupOf =
  (found: ActionJob | undefined): JobLookup =>
  (spaceId, jobId) =>
    Promise.resolve(found && found.spaceId === spaceId && found.id === jobId ? found : undefined);

describe('who may watch a job', () => {
  it('lets in whoever started it, and nobody else unless its watch says so', async () => {
    const own = lookupOf(job());

    expect(await jobRefusal(own, 1, 'job:1:a', visitor(3))).toBeUndefined();
    expect(await jobRefusal(own, 1, 'job:1:a', visitor(4))).toBe('forbidden');
    expect(await jobRefusal(own, 1, 'job:1:a', undefined)).toBe('unauthenticated');
  });

  it('reads its watch against the visitor’s permissions in the space', async () => {
    const watched = lookupOf(
      job({ function: { user: job().function?.user, watch: { mode: 'role', permissions: ['models.read'] } } })
    );

    expect(await jobRefusal(watched, 1, 'job:1:a', visitor(4, ['models.read']))).toBeUndefined();
    expect(await jobRefusal(watched, 1, 'job:1:a', visitor(4))).toBe('forbidden');
    expect(await jobRefusal(watched, 1, 'job:1:a', undefined)).toBe('unauthenticated');
  });

  it('is no topic at all for a run of an action, a job of another space, or none', async () => {
    const { function: _function, ...flow } = job();

    expect(await jobRefusal(lookupOf(flow), 1, 'job:1:a', visitor(3))).toBe('undeclared');
    expect(await jobRefusal(lookupOf(job()), 2, 'job:1:a', visitor(3))).toBe('undeclared');
    expect(await jobRefusal(undefined, 1, 'job:1:a', visitor(3))).toBe('undeclared');
  });
});
