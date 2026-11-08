import { describe, expect, it } from 'vitest';

import { codeMarkingQueue } from './codeMarks';
import { createMemoryJobQueue } from './memoryQueue';
import { jobInput } from './tests/jobWorld';

import type { ActionDocument, ActionEntry } from '@plitzi/sdk-shared';

const documentOf = (action: string): ActionDocument => ({
  name: action,
  output: {},
  nodes: {
    step: {
      id: 'step',
      title: 'Step',
      type: 'task',
      action,
      params: {},
      preview: {},
      elementId: null,
      beforeNode: '',
      afterNode: '',
      flowId: 'flow',
      enabled: true
    }
  }
});

/** What a worker whose runs wait for a runner reads to go on taking the jobs that need none. */
describe('a job as it is queued', () => {
  it('is marked as running the space’s code when its action does, and left as it is otherwise', async () => {
    const queue = createMemoryJobQueue();
    const entries: ActionEntry[] = [
      { id: 'sync', document: documentOf('shop.sync') },
      { id: 'beat', document: documentOf('flow.delay') }
    ];
    const marking = codeMarkingQueue(
      queue,
      {
        getAction: (_spaceId, actionId) => Promise.resolve(entries.find(entry => entry.id === actionId)),
        listActions: () => Promise.resolve(entries)
      },
      document => Object.values(document.nodes).some(node => node.action === 'shop.sync')
    );

    await marking.enqueue(jobInput({ id: 'syncing', target: { kind: 'action', name: 'sync', trigger: 'schedule' } }));
    await marking.enqueue(jobInput({ id: 'beating', target: { kind: 'action', name: 'beat', trigger: 'schedule' } }));

    expect((await queue.getJob([1], 'syncing'))?.target).toMatchObject({ code: true });
    expect((await queue.getJob([1], 'beating'))?.target).not.toHaveProperty('code');
  });
});
