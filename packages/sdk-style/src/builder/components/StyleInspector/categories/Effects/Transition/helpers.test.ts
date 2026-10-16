import { describe, expect, it } from 'vitest';

import {
  easingCss,
  easingCurve,
  easingOptions,
  parseTransition,
  serializeTransition,
  transitionSummary
} from './helpers';

describe('parseTransition', () => {
  it('reads the four parts in their usual order', () => {
    expect(parseTransition('opacity 200ms ease-in 50ms')).toEqual({
      property: 'opacity',
      duration: '200ms',
      easing: 'ease-in',
      delay: '50ms'
    });
  });

  it('fills what is left out the way CSS does', () => {
    expect(parseTransition('transform 0.3s')).toEqual({
      property: 'transform',
      duration: '0.3s',
      easing: 'ease',
      delay: '0s'
    });
  });

  it('reads the parts in any order, an easing function included', () => {
    expect(parseTransition('300ms cubic-bezier(0.4, 0, 0.2, 1) 100ms color')).toEqual({
      property: 'color',
      duration: '300ms',
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      delay: '100ms'
    });
  });

  it('defaults the property to all', () => {
    expect(parseTransition('150ms')?.property).toBe('all');
  });

  it('answers undefined for what is not one transition', () => {
    expect(parseTransition('var(--transition-fast)')).toBeUndefined();
    expect(parseTransition('opacity 1s 2s 3s')).toBeUndefined();
  });

  it('round-trips a complete transition', () => {
    const value = 'box-shadow 160ms ease-out 0ms';
    const transition = parseTransition(value);

    expect(transition && serializeTransition(transition)).toBe(value);
  });
});

describe('easings', () => {
  const presets: Record<string, [number, number, number, number]> = {
    ease: [0.25, 0.1, 0.25, 1],
    easeInQuad: [0.11, 0, 0.5, 0]
  };

  it('writes a preset that is not a CSS keyword as its curve', () => {
    expect(easingCss('easeInQuad', presets)).toBe('cubic-bezier(0.11, 0, 0.5, 0)');
    expect(easingCss('ease', presets)).toBe('ease');
  });

  it('offers every preset with a name a person reads and a value CSS reads', () => {
    expect(easingOptions(presets)).toEqual([
      { label: 'Ease', value: 'ease' },
      { label: 'Ease In Quad', value: 'cubic-bezier(0.11, 0, 0.5, 0)' }
    ]);
  });

  it('reads the curve of a keyword and of a cubic-bezier', () => {
    expect(easingCurve('ease', presets)).toEqual([0.25, 0.1, 0.25, 1]);
    expect(easingCurve('cubic-bezier(0.4, 0, 0.2, 1)', presets)).toEqual([0.4, 0, 0.2, 1]);
    expect(easingCurve('steps(4)', presets)).toBeUndefined();
  });
});

describe('transitionSummary', () => {
  it('names the property and the duration, and the delay only when there is one', () => {
    expect(transitionSummary({ property: 'opacity', duration: '200ms', easing: 'ease', delay: '0ms' })).toBe(
      'opacity 200ms'
    );
    expect(transitionSummary({ property: 'opacity', duration: '200ms', easing: 'ease', delay: '0s' })).toBe(
      'opacity 200ms'
    );
    expect(transitionSummary({ property: 'opacity', duration: '200ms', easing: 'ease', delay: '50ms' })).toBe(
      'opacity 200ms after 50ms'
    );
  });
});
