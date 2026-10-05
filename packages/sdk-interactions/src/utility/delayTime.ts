import type { InteractionCallback } from '@plitzi/sdk-shared';

/**
 * Waits `time` milliseconds before the next step.
 *
 * The wait ends early when the flow is superseded (`whileRunning: 'latest'`): the run is over, and holding a timer
 * for it only keeps it alive for nothing. That pair is how a flow is debounced — `whileRunning('latest')` and a
 * `delay(450)` first: every new firing stops the one still waiting, and only the last gets past the wait.
 */
const delayTime: InteractionCallback<{ time: number }> = {
  action: 'delayTime',
  title: 'Delay Time',
  type: 'utility',
  params: { time: { label: 'Time (Milliseconds)', type: 'number' } },
  preview: {},
  callback: ({ time }, context) =>
    new Promise(resolve => {
      const signal = context?.signal;
      if (signal?.aborted) {
        resolve(undefined);

        return;
      }

      const done = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', done);
        resolve(undefined);
      };
      const timer = setTimeout(done, time);
      signal?.addEventListener('abort', done, { once: true });
    })
};

export default delayTime;
