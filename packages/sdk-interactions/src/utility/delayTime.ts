import type { InteractionCallback } from '@plitzi/sdk-shared';

const delayTime: InteractionCallback<{ time: number }> = {
  action: 'delayTime',
  title: 'Delay Time',
  type: 'utility',
  params: { time: { label: 'Time (Milliseconds)', type: 'text' } },
  preview: {},
  callback: ({ time }) =>
    new Promise(res => {
      setTimeout(res, time);
    })
};

export default delayTime;
