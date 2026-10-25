import { describe, expect, it } from 'vitest';

import { agentTimelines } from './agentTimeline';

const at = (minute: number) => new Date(Date.UTC(2030, 0, 1, 10, minute)).toISOString();

describe("an agent's timeline", () => {
  it('reads a stop followed by a notice as stopped, a quiet task as silent, and repeated waits as one', () => {
    const log = [
      { at: at(0), by: 'lead', action: 'launch', agent: 'test-1' },
      { at: at(1), by: 'test-1', action: 'joined' },
      { at: at(1), by: 'test-1', action: 'waiting', why: 'nothing ready for a tester' },
      { at: at(2), by: 'test-1', action: 'waiting', why: 'nothing ready for a tester' },
      { at: at(3), by: 'test-1', action: 'take', task: 't-tests' },
      // Writing tests for 20 minutes with nothing logged: a silence.
      { at: at(23), by: 'test-1', action: 'complete', task: 't-tests' },
      { at: at(24), by: 'test-1', action: 'stops', why: 't-tests is complete: one task a session' },
      // A run's test-1 said a notice after its stop: still stopped, never silent.
      { at: at(24), by: 'test-1', action: 'notice', text: 'something of Plitzi' }
    ];

    const [life] = agentTimelines(log, new Date(Date.parse(at(60))));

    expect(life.agent).toBe('test-1');
    expect(life.launches).toBe(1);
    expect(life.moments.filter(moment => moment.what.startsWith('waited'))).toHaveLength(1);
    expect(life.stops).toEqual([{ at: at(24), what: 'stopped: t-tests is complete: one task a session' }]);
    expect(life.minutes.stopped).toBe(36);
    expect(life.silences).toEqual([{ from: at(3), minutes: 20 }]);
  });

  it('ends at the end it is given, and counts no call an agent never named as an agent', () => {
    const log = [
      { at: at(0), by: 'lead', action: 'launch', agent: 'dev-1' },
      { at: at(1), by: 'dev-1', action: 'waiting', why: 'every task is done' },
      { at: at(5), by: 'unnamed', action: 'refused', code: 'identity' },
      // Past the end — the person's finish, hours later — nothing counts.
      { at: at(50), by: 'dev-1', action: 'waiting', why: 'the run is finishing' }
    ];

    const lives = agentTimelines(log, new Date(Date.parse(at(10))));

    expect(lives.map(life => life.agent)).toEqual(['dev-1']);
    expect(lives[0].minutes).toEqual({ active: 10, stopped: 0, silent: 0 });
  });
});
