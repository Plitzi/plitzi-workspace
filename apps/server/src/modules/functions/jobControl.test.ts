import { describe, expect, it } from 'vitest';

import { createJobControl } from './jobControl';
import { createMemoryJobQueue } from '../actions/jobs/memoryQueue';
import { createMemoryKv } from '../actions/runtime/memoryKv';
import { adapterTopic } from '../realtime/hub';
import { createMemoryPubSub } from '../realtime/memoryPubSub';
import { createRealtimeRetained } from '../realtime/retained';

import type { RealtimeMessage } from '@plitzi/sdk-shared';

const SPACE = { spaceId: 1, environment: 'main' };

describe('an operator’s hold on the jobs', () => {
  it('sets a job aside and back from a process of its own, telling whoever watches it', async () => {
    const queue = createMemoryJobQueue();
    const pubsub = createMemoryPubSub();
    const kv = createMemoryKv();
    const heard: RealtimeMessage[] = [];
    await pubsub.subscribe(adapterTopic(SPACE, '$job:job:1:a'), raw => {
      heard.push(JSON.parse(raw) as RealtimeMessage);
    });
    await queue.enqueue({
      id: 'job:1:a',
      spaceId: 1,
      environment: 'main',
      target: { kind: 'function', name: 'train' },
      input: {},
      dueAt: Date.now(),
      maxAttempts: 3
    });
    const control = createJobControl({ queue, realtime: { pubsub, kv } });

    expect(await control.pause([1], 'job:1:a')).toBe(true);
    expect(await control.pause([1], 'job:1:a')).toBe(false);
    expect(heard.map(message => (message.data as { status: string }).status)).toEqual(['paused']);
    expect(await createRealtimeRetained(kv).of(SPACE, '$job:job:1:a')).toMatchObject([
      { type: 'job', retained: true, data: { id: 'job:1:a', status: 'paused' } }
    ]);

    expect(await control.resume([2], 'job:1:a')).toBe(false);
    expect(await control.resume([1], 'job:1:a')).toBe(true);
    expect(heard.at(-1)?.data).toMatchObject({ status: 'pending' });
  });

  it('changes the queue alone where there is no realtime to tell', async () => {
    const queue = createMemoryJobQueue();
    await queue.enqueue({
      id: 'job:1:b',
      spaceId: 1,
      environment: 'main',
      target: { kind: 'function', name: 'train' },
      input: {},
      dueAt: Date.now(),
      maxAttempts: 3
    });

    expect(await createJobControl({ queue }).cancel([1], 'job:1:b')).toBe(true);
    expect((await queue.getJob([1], 'job:1:b'))?.status).toBe('cancelled');
  });
});
