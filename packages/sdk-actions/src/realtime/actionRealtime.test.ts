import { describe, expect, it } from 'vitest';

import { createActionRealtime } from '.';

import type { OfflineDataRaw, PubSubAdapter } from '@plitzi/sdk-shared';

/** A space that declares one channel, as its schema says it. Only its channels are read: the rest of a space is no part
 *  of what is checked, so the document is cast from what the test writes of it. */
const offlineData = {
  schema: { settings: { channels: { 'monitor:{id}': { publish: 'server' } } }, elements: {} },
  style: {}
} as unknown as OfflineDataRaw;

/** The deployment's pubsub — Redis on a real one — recording what is said on it. */
const recordingPubSub = () => {
  const said: { topic: string; message: string }[] = [];
  const pubsub: PubSubAdapter = {
    publish: (topic, message) => {
      said.push({ topic, message });

      return Promise.resolve();
    },
    subscribe: () => Promise.resolve(() => Promise.resolve())
  };

  return { pubsub, said };
};

describe('the realtime of an actions runner that serves no pages', () => {
  // A job a queue hands this runner says what it found on the same bus the page servers listen on.
  it('publishes on the deployment’s own pubsub, checked against the space’s channels', async () => {
    const { pubsub, said } = recordingPubSub();
    const realtime = createActionRealtime({ getOfflineData: () => Promise.resolve(offlineData), pubsub });

    await realtime.publish({ spaceId: 4, environment: 'main' }, 'monitor:world', 'sweep', { fresh: 12 });

    expect(said).toHaveLength(1);
    expect(JSON.parse(said[0]?.message ?? '{}')).toMatchObject({
      topic: 'monitor:world',
      type: 'sweep',
      data: { fresh: 12 },
      from: 'server'
    });
  });

  it('refuses a topic the space declares no channel for, naming where to declare it', async () => {
    const { pubsub, said } = recordingPubSub();
    const realtime = createActionRealtime({ getOfflineData: () => Promise.resolve(offlineData), pubsub });

    await expect(realtime.publish({ spaceId: 4, environment: 'main' }, 'chat:1', 'x', {})).rejects.toThrow(
      'declare it in the space'
    );
    expect(said).toHaveLength(0);
  });
});
