import { describe, expect, it } from 'vitest';

import { processTwig } from '@plitzi/sdk-shared/helpers/twigWrapper';

import { cycleState, stepState } from './steps';

import type { setState } from './steps';

/** What a step's `value` evaluates to with this state. */
const after = (step: ReturnType<typeof setState>, state: Record<string, unknown>): string =>
  String(processTwig(String(step.params?.value), { state }));

describe('cycleState', () => {
  it('goes round: after the last is the first, before the first the last', () => {
    expect(after(cycleState({ key: 'slide', length: 3 }), { slide: 2 })).toBe('0');
    expect(after(cycleState({ key: 'slide', length: 3, by: -1 }), { slide: 0 })).toBe('2');
    expect(after(cycleState({ key: 'slide', length: 3 }), {})).toBe('1');
  });

  it('takes a length to count, and is the setState it stands for', () => {
    const step = cycleState({ key: 'slide', length: 'slides|length' });

    expect(String(processTwig(String(step.params?.value), { state: { slide: 1 }, slides: ['a', 'b'] }))).toBe('0');
    expect(step).toMatchObject({
      type: 'globalCallback',
      action: 'setState',
      params: { key: 'slide', type: 'number' }
    });
  });
});

describe('stepState', () => {
  it('moves by a step and stops at its bounds', () => {
    expect(after(stepState({ key: 'shown', by: 40, max: 100 }), { shown: 80 })).toBe('100');
    expect(after(stepState({ key: 'shown', by: -40, min: 0 }), { shown: 20 })).toBe('0');
    expect(after(stepState({ key: 'shown', by: 40 }), {})).toBe('40');
  });
});
