import { describe, expect, it } from 'vitest';

import {
  isMotion,
  isMotionAnimation,
  MOTION_PLAY_CSS,
  motionAttributes,
  motionProblems
} from './motion';

describe('motion', () => {
  it('takes the presets it names, and says what is wrong with anything else', () => {
    expect(isMotion({ enter: 'fade-up', on: 'view', duration: 400, delay: 100 })).toBe(true);
    expect(isMotion({ loop: 'float' })).toBe(true);
    expect(motionProblems({ enter: 'bounce', on: 'hover', duration: -1, speed: 2 })).toEqual([
      'motion has no "speed" — it takes enter, on, duration, delay, stagger and loop',
      'motion.enter is one of fade, fade-up, fade-down, slide-left, slide-right, scale',
      'motion.on is load, view or scroll',
      'motion.duration is a number of ms from 0 to 10000'
    ]);
    expect(motionProblems({})).toEqual(['motion says nothing to play: give it an `enter`, a `loop`, or both']);
    expect(motionProblems({ loop: 'pulse', stagger: 80 })).toContain(
      'motion.stagger staggers the children’s `enter`: give it one'
    );
  });

  it('is data attributes and custom properties in the DOM — nothing at all for an element without it', () => {
    expect(motionAttributes(undefined)).toEqual({ attributes: {}, style: {} });
    expect(motionAttributes({ enter: 'fade-up', on: 'view', delay: 120, loop: 'float' })).toEqual({
      attributes: { 'data-motion-enter': 'fade-up', 'data-motion-on': 'view', 'data-motion-loop': 'float' },
      style: { '--plitzi-motion-delay': '120ms' }
    });
    // Staggered, the enter is the children's: the element itself does not arrive.
    expect(motionAttributes({ enter: 'scale', stagger: 60 })).toEqual({
      attributes: { 'data-motion-stagger': 'scale', 'data-motion-on': 'load' },
      style: { '--plitzi-motion-stagger': '60ms' }
    });
  });

  it('tells the declared motion\'s animations from any other the page runs', () => {
    // jsdom has no Web Animations: what the check reads of a CSS animation is its name.
    expect(isMotionAnimation({ animationName: 'plitzi-motion-fade-up' })).toBe(true);
    expect(isMotionAnimation({ animationName: 'spin-logo' })).toBe(false);
    expect(isMotionAnimation({})).toBe(false);
  });

  it('plays an arrival tied to the scroll by the clock on the canvas, where it is usually in view already', () => {
    expect(MOTION_PLAY_CSS).toContain('[data-motion-on="scroll"][data-motion-enter]');
    expect(MOTION_PLAY_CSS).toContain('animation-timeline: auto, auto !important');
  });

  it('plays an arrival waiting to be seen at once on the canvas', () => {
    expect(MOTION_PLAY_CSS).toContain(
      '[data-motion-on="view"][data-motion-enter], [data-motion-on="view"][data-motion-stagger] > * { animation-play-state: running, running !important; }'
    );
  });
});
