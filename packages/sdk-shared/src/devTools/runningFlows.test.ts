import { describe, expect, it } from 'vitest';

import { flowStarted, flowsRunning } from './runningFlows';

describe('the flows running now', () => {
  it('holds each flow from its start until it ends, the oldest first, and lets it go once', () => {
    const load = flowStarted({ trigger: 'Load [onPageLoad]', on: 'home', since: 10 });
    const click = flowStarted({ trigger: 'Play [onClick]', on: 'play', since: 20 });

    expect(flowsRunning().map(flow => flow.trigger)).toEqual(['Load [onPageLoad]', 'Play [onClick]']);

    load();
    load();

    expect(flowsRunning()).toEqual([{ trigger: 'Play [onClick]', on: 'play', since: 20 }]);

    click();

    expect(flowsRunning()).toEqual([]);
  });
});
