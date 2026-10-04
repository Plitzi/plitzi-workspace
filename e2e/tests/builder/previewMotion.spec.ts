import { authorSpace, container, styles, text } from '@plitzi/sdk-authoring';

import { describeTarget, expect, test } from '../../fixtures';

import type { FrameLocator, Page } from '@playwright/test';

/** The builder's preview is the page as a visitor gets it — motion included.
 *
 *  Editing, the canvas holds motion still (Play shows it). In preview it used to hold it too, by omission: nothing
 *  marked the canvas live (`data-hydrated`, which the SDK's root sets on a published page), so the loops — the
 *  declared ones and a space's own CSS keyed off it — never started, and an arrival waiting to be seen never played.
 *  This is that, end to end: the loop runs, the space's own animation runs, the arrival is seen — and editing again
 *  holds them still. */

const IDS = { page: 'preview-motion-page', loop: 'preview-loop', own: 'preview-own', arrival: 'preview-arrival' };

const own = styles('e2e-own', {
  width: '40px',
  height: '40px',
  backgroundColor: '#7c3aed',
  animation: 'e2e-turn 2s linear infinite paused'
});

const previewMotionSpace = () =>
  authorSpace({
    name: 'preview-motion',
    permanentUrl: 'preview-motion',
    // The space's own loop, held until the page is live — the way the motion guide asks for one.
    customCss: [
      '@keyframes e2e-turn { to { transform: rotate(360deg); } }',
      '[data-hydrated] .e2e-own { animation-play-state: running; }'
    ].join('\n'),
    pages: [
      {
        id: IDS.page,
        name: 'Home',
        slug: '',
        body: [
          text({ id: IDS.loop, content: 'Turning', motion: { loop: 'spin' } }),
          container({ id: IDS.own, class: own }),
          text({ id: IDS.arrival, content: 'Arriving', motion: { enter: 'fade-up', on: 'view' } })
        ]
      }
    ]
  });

const canvas = (page: Page): FrameLocator => page.frameLocator('iframe').first();

/** The play state of every animation the element runs — empty when it runs none. */
const playStates = (frame: FrameLocator, id: string): Promise<string[]> =>
  frame
    .locator(`[data-plitzi-el="${id}"]`)
    .evaluate(element => element.getAnimations().map(animation => animation.playState));

const previewButton = (page: Page) => page.getByTitle('Preview: use the page as a visitor would');

describeTarget('builder', subject => {
  test.use({ mockSpace: previewMotionSpace() });

  test('plays the motion in preview, and holds it still while editing', async ({ page }) => {
    await page.goto(subject.origin, { waitUntil: 'domcontentloaded' });
    const frame = canvas(page);
    await expect(frame.locator(`[data-plitzi-el="${IDS.own}"]`)).toBeAttached({ timeout: 60_000 });

    // Editing: the declared loop is held off altogether, the space's own one waits for a page that is live.
    await expect.poll(() => playStates(frame, IDS.loop)).toEqual([]);
    await expect.poll(() => playStates(frame, IDS.own)).toEqual(['paused']);

    await previewButton(page).click();

    await expect(frame.locator('html')).toHaveAttribute('data-hydrated', '');
    await expect.poll(() => playStates(frame, IDS.loop)).toContain('running');
    await expect.poll(() => playStates(frame, IDS.own)).toEqual(['running']);
    await expect(frame.locator(`[data-plitzi-el="${IDS.arrival}"]`)).toHaveAttribute('data-motion-seen', '');

    await page.getByTitle('Back to editing').click();

    await expect(frame.locator('html')).not.toHaveAttribute('data-hydrated', '');
    await expect.poll(() => playStates(frame, IDS.own)).toEqual(['paused']);
  });
});
