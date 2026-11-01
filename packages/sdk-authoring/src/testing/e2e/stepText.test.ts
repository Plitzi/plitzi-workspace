import { describe, expect, it } from 'vitest';

import { e2e } from './define';
import { e2eStepText, parseE2eStep, parseE2eSteps, stepLines } from './stepText';

import type { E2eStep } from '@plitzi/sdk-shared';

// One way to write a step as words: a page command's --steps and a journey the space keeps say it alike.
describe('a journey’s steps as words', () => {
  const steps: E2eStep[] = [
    e2e.click('map', { x: 30, y: 60 }),
    e2e.hover('add'),
    e2e.scroll('site-footer'),
    e2e.scroll('genres', { dx: 200 }),
    e2e.type('chat-input', 'late; still here'),
    e2e.drag('volume-handle', -120, 0),
    e2e.press('Escape'),
    e2e.waitFor('room-player', 40_000),
    e2e.goto('/r/night-drive'),
    e2e.back(),
    e2e.reload(),
    e2e.setState('show', { title: 'Late set' }),
    e2e.setSource('apiContainer_feed.items', []),
    e2e.tick(90_000),
    e2e.expectShown('cart'),
    e2e.expectHidden('login-refused'),
    e2e.expectText('cart-count', '1 item'),
    e2e.expectText('cart-count', '1 item', { exact: true }),
    e2e.expectState('sheetTab', 'log'),
    e2e.expectAttribute('play', 'aria-pressed', 'true'),
    e2e.expectStyle('key', 'min-height', '44px', '>='),
    e2e.expectStyle('card', 'background-color', 'rgb(255, 255, 255)'),
    e2e.expectPosition('activity.bottom + 8 <= legend.top'),
    e2e.expectCheck('count-reads')
  ];

  it('are read back as the steps they were written from', () => {
    expect(steps.map(step => parseE2eStep(e2eStepText(step)))).toEqual(steps);
    expect(parseE2eSteps(steps.map(e2eStepText).join('; '))).toEqual(steps);
  });

  it('read a selector with spaces whole, and a line a journey does not know as none of its own', () => {
    expect(parseE2eStep('click .panel button')).toEqual({ kind: 'click', element: '.panel button' });
    expect(parseE2eStep('fill email=ana@x.com')).toEqual({ kind: 'type', element: 'email', text: 'ana@x.com' });
    expect(parseE2eStep('shot opened')).toBeUndefined();
    expect(parseE2eStep('click map 120,340')).toEqual({ problem: expect.stringContaining('in percent') as unknown });
    // A run's `scroll <row> 200` reached Playwright as one selector, and came back as its parse error.
    expect(parseE2eStep('click explore-genres 200')).toEqual({
      problem: expect.stringContaining('click takes an element alone — 200 is no part of one') as unknown
    });
    expect(parseE2eSteps('click add; frames 3')).toEqual({
      problem: expect.stringContaining('step 2 ("frames 3"): "frames" is not a step') as unknown
    });
  });

  it('are cut at each ; or line outside quotes, notes and blanks left out', () => {
    expect(stepLines('type chat "a; b"\n# a note\n\nclick send')).toEqual(['type chat "a; b"', 'click send']);
  });
});
