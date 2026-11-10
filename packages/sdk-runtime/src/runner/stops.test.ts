import { describe, expect, it } from 'vitest';

import { FunctionFailure } from '@plitzi/sdk-shared/functions';

import { ISOLATE_TIMEOUT, SHED_SAID, createStops, failureOfStop, failureOfThrown, stopMessage } from './stops';

import type { FunctionLimits } from '@plitzi/sdk-shared/functions';

const LIMITS: FunctionLimits = { cpuMs: 100, wallMs: 1000, memoryMb: 32, outputBytes: 500, calls: 3 };

describe('why an invocation stopped, said', () => {
  it('names the limit it went past, and its number', () => {
    expect(stopMessage('cpu', LIMITS)).toBe('Stopped after 100 ms of CPU');
    expect(stopMessage('wall', LIMITS)).toBe('Did not finish within 1000 ms');
    expect(stopMessage('output', LIMITS)).toBe('Answered more than the 500 bytes it may');
    expect(stopMessage('calls', LIMITS)).toBe('Made more than the 3 calls to the platform it may');
    expect(stopMessage('aborted', LIMITS)).toBe('The run was aborted');
  });

  it('says, past its memory, the size to ask for — or that it ran with the most there is', () => {
    expect(stopMessage('memory', LIMITS)).toContain(
      "(a small task): a task that needs more asks to be larger in its limits ({ size: 'medium' })"
    );
    expect(stopMessage('memory', { ...LIMITS, memoryMb: 256 })).toBe(
      'Went over its 256 MB of memory (a large task), the most a task runs with: hold less of it at once'
    );
  });

  it('reads to the platform as its own limit, and as busy when the runner gave it back', () => {
    expect(failureOfStop('cpu', LIMITS)).toMatchObject({ reason: 'cpu', message: 'Stopped after 100 ms of CPU' });
    expect(failureOfStop('shed', LIMITS)).toMatchObject({ reason: 'busy', message: SHED_SAID });
  });
});

describe('what an invocation that threw failed with', () => {
  it('is a failure of its own, as itself, when nothing stopped it', () => {
    const refused = new FunctionFailure('refused', 'Not yours');

    expect(failureOfThrown(refused, { stopped: undefined, disposed: false, limits: LIMITS })).toBe(refused);
  });

  it('is the reason it was stopped for, whatever it threw after', () => {
    expect(
      failureOfThrown(new FunctionFailure('error', 'later'), { stopped: 'calls', disposed: true, limits: LIMITS })
    ).toMatchObject({ reason: 'calls' });
  });

  it("is its time when isolated-vm's own timeout ran out, and its memory when V8 took the isolate down", () => {
    expect(
      failureOfThrown(new Error(ISOLATE_TIMEOUT), { stopped: undefined, disposed: true, limits: LIMITS })
    ).toMatchObject({ reason: 'wall' });
    expect(
      failureOfThrown(new Error('Isolate was disposed'), { stopped: undefined, disposed: true, limits: LIMITS })
    ).toMatchObject({ reason: 'memory' });
  });

  it("is the code's own error otherwise", () => {
    expect(
      failureOfThrown(new Error('no feed today'), { stopped: undefined, disposed: false, limits: LIMITS })
    ).toMatchObject({
      reason: 'error',
      message: 'no feed today'
    });
    expect(failureOfThrown('a string', { stopped: undefined, disposed: false, limits: LIMITS }).message).toBe(
      'a string'
    );
  });
});

describe('the stops', () => {
  it('keep the first reason, and dispose each time they are asked to stop', () => {
    let disposed = 0;
    const stops = createStops(() => {
      disposed++;
    });

    stops.stop('cpu');
    stops.stop('wall');

    expect(stops.stopped()).toBe('cpu');
    expect(disposed).toBe(2);
  });
});
