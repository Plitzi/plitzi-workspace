import { describe, expect, it } from 'vitest';

import { exposureOf, exposureProps, goalOf, goalProps, isGoalName } from './experimentEvents';

describe('measuring an experiment', () => {
  it('reports a visitor’s variant, and reads it back', () => {
    expect(exposureOf(exposureProps('heroTest', 'b'))).toEqual({ experiment: 'heroTest', variant: 'b' });
    expect(exposureOf({ experiment: 'heroTest', variant: 'z' })).toBeUndefined();
    expect(exposureOf(undefined)).toBeUndefined();
  });

  it('reports a goal with the visitor’s variants, and reads them back', () => {
    const props = goalProps('signup', { heroTest: 'b', pricing: 'a' });

    expect(props).toEqual({ goal: 'signup', 'ab.heroTest': 'b', 'ab.pricing': 'a' });
    expect(goalOf(props)).toEqual({ goal: 'signup', assignments: { heroTest: 'b', pricing: 'a' } });
    expect(goalOf({ goal: 'sign up' })).toBeUndefined();
    expect(goalOf({ goal: 'signup', 'ab.x': 'q', other: 'b' })).toEqual({ goal: 'signup', assignments: {} });
  });

  it('names a goal with letters, digits, - and _', () => {
    expect(isGoalName('checkout-done')).toBe(true);
    expect(isGoalName('')).toBe(false);
  });
});
