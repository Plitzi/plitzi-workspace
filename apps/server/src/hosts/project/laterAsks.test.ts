import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { LATER_ANSWER_FILE, LATER_ASK_FILE } from '@plitzi/sdk-shared/project';

import { answerLaterAsk, watchLaterAsks } from './laterAsks';
import { createMemoryJobQueue } from '../../modules/actions/jobs';

import type { JobQueue } from '@plitzi/sdk-shared';

const SPACE = 1;
const HOUR = 3_600_000;

/** A queue holding what a room's show set for later, as `ctx.later` sets it: due in an hour, under its key. */
const withShow = async (): Promise<{ queue: JobQueue; due: number }> => {
  const queue = createMemoryJobQueue();
  const due = (await queue.now()).getTime() + HOUR;
  await queue.enqueue({
    id: 'later:1:show-1',
    spaceId: SPACE,
    environment: 'main',
    target: { kind: 'action', name: 'shows-start', trigger: 'later' },
    input: { show: 'show-1' },
    dueAt: due,
    maxAttempts: 3,
    key: 'show:show-1'
  });

  return { queue, due };
};

// A spec of a show that starts in five minutes waited the five real minutes, every pass.
describe('plitzi functions later, as the project server answers it', () => {
  it('lists what waits to run later, by its key and when it is due', async () => {
    const { queue, due } = await withShow();

    expect(await answerLaterAsk(queue, SPACE, { id: 'a1', ask: 'list' })).toEqual({
      id: 'a1',
      waiting: [{ job: 'later:1:show-1', action: 'shows-start', key: 'show:show-1', dueAt: due }]
    });
  });

  it('starts one now: set again under its key, due now, the one waiting dropped', async () => {
    const { queue } = await withShow();
    const answer = await answerLaterAsk(queue, SPACE, { id: 'a2', ask: 'now', key: 'show:show-1' });
    const pending = await queue.listJobs({ spaceIds: [SPACE], status: 'pending', limit: 10, offset: 0 });

    expect('started' in answer && answer.started.key).toBe('show:show-1');
    expect(pending.jobs).toHaveLength(1);
    expect(pending.jobs[0]?.dueAt).toBeLessThanOrEqual((await queue.now()).getTime());
    expect(pending.jobs[0]?.input).toEqual({ show: 'show-1' });
  });

  it('says what waits when the key asked names nothing', async () => {
    const { queue } = await withShow();

    expect(await answerLaterAsk(queue, SPACE, { id: 'a3', ask: 'now', key: 'show:nope' })).toEqual({
      id: 'a3',
      problem: 'Nothing waits to run later under "show:nope": what waits is show:show-1'
    });
  });
});

describe('the ask, through the project’s tmp/', () => {
  let root: string | undefined;

  afterEach(async () => {
    if (root !== undefined) {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('is read, removed, and answered beside it', async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'later-asks-'));
    const { queue } = await withShow();
    const dir = root;
    await mkdir(path.join(dir, path.dirname(LATER_ASK_FILE)), { recursive: true });
    await writeFile(path.join(dir, LATER_ASK_FILE), JSON.stringify({ id: 'a4', ask: 'list' }));
    const stop = watchLaterAsks(dir, () => queue, SPACE, { everyMs: 10 });
    await vi.waitFor(async () => {
      const answer: unknown = JSON.parse(await readFile(path.join(dir, LATER_ANSWER_FILE), 'utf-8'));
      expect(answer).toMatchObject({ id: 'a4', waiting: [{ key: 'show:show-1' }] });
    });
    stop();
    await expect(readFile(path.join(dir, LATER_ASK_FILE))).rejects.toThrow();
  });
});
