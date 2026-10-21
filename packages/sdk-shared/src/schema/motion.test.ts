import { describe, expect, it } from 'vitest';

import {
  isMotion,
  isMotionAnimation,
  MOTION_PLAY_CSS,
  MOTION_TRAVEL_PROPERTY,
  motionAttributes,
  motionProblems,
  travelled
} from './motion';

describe('motion', () => {
  it('takes the presets it names, and says what is wrong with anything else', () => {
    expect(isMotion({ enter: 'fade-up', on: 'view', duration: 400, delay: 100 })).toBe(true);
    expect(isMotion({ loop: 'float' })).toBe(true);
    expect(motionProblems({ enter: 'bounce', on: 'hover', duration: -1, speed: 2 })).toEqual([
      'motion has no "speed" — it takes enter, on, duration, delay, stagger, loop, easing and distance',
      'motion.enter is one of fade, fade-up, fade-down, slide-left, slide-right, slide-up, scale, zoom-in, zoom-out, pop, bounce-in, tilt, spin-in',
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

  // la-velada copied its original's arrivals value for value — `fade-in-up .6s ease-in-out 20px` — and, with a curve and
  // a distance the presets could not take, wrote eight keyframes of its own instead.
  it('takes the curve and the distance of an arrival, as CSS and px — and only for one that travels', () => {
    expect(motionProblems({ enter: 'fade-up', easing: 'ease-in-out', distance: 20 })).toEqual([]);
    expect(motionProblems({ enter: 'fade', easing: 'cubic-bezier(0.4, 0, 0.2, 1)' })).toEqual([]);
    expect(motionProblems({ enter: 'fade', easing: 'steps(4, jump-end)' })).toEqual([]);
    expect(motionProblems({ enter: 'fade', easing: 'cubic-bezier(1.4, 0, 0.2, 1)' })[0]).toContain('motion.easing');
    expect(motionProblems({ enter: 'fade', easing: 'wobbly' })[0]).toContain('motion.easing');
    expect(motionProblems({ enter: 'zoom-in', distance: 20 })[0]).toContain('zoom-in does not');
    expect(motionProblems({ enter: 'fade-up', distance: 900 })[0]).toContain('from 0 to 400');
    expect(motionProblems({ loop: 'float', easing: 'linear' })).toContain(
      'motion.easing is the curve of its `enter`: give it one'
    );

    expect(motionAttributes({ enter: 'fade-up', easing: 'ease-in-out', distance: 20 }).style).toMatchObject({
      '--plitzi-motion-easing': 'ease-in-out',
      [MOTION_TRAVEL_PROPERTY]: String(Math.round((20 / 24) * 10_000) / 10_000)
    });
    expect(travelled('0 -24px')).toBe(`0 calc(var(${MOTION_TRAVEL_PROPERTY}, 1) * -24px)`);
  });

  it('tells the animations of the declared motion from any other the page runs', () => {
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
