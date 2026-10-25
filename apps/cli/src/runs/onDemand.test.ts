import { describe, expect, it } from 'vitest';

import { runningAgents, stoppedAgents } from './onDemand';

// Design-1 stopped for a fresh context, was launched again, and read "stopped" until its first command.
describe('who of the team is stopped', () => {
  it('counts an agent launched again as running, before its first command', () => {
    const log = [
      { by: 'design-1', action: 'take', task: 't-home' },
      { by: 'design-1', action: 'stops', why: 'a fresh context' },
      { by: 'lead', action: 'launch', agent: 'design-1', harness: 'claude' }
    ];

    expect(stoppedAgents(log).has('design-1')).toBe(false);
    expect(runningAgents(log).has('design-1')).toBe(true);
    expect(stoppedAgents(log.slice(0, 2)).has('design-1')).toBe(true);
  });
});
