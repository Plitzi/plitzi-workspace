import { describeTarget, expect, isMockBackend, test } from '../../fixtures';

/** The builder, as far as this session takes it: it mounts, it loads a space, and that space is on screen.
 *
 *  That is a smaller claim than it looks. The builder renders the space it is editing inside an iframe, through
 *  the same SDK the `sdk` category covers on its own — so what this proves is the part neither covers: the app
 *  boots, authenticates, asks a backend for a space, and hands what came back to the renderer. Every one of those
 *  is a seam, and a break in any of them shows up here as an empty canvas.
 *
 *  Driving the editor — adding elements, styling them, binding them — comes next, spec by spec. */
describeTarget('builder', subject => {
  /** Whatever the space is, it renders through the SDK, and the SDK marks every element it renders. Counting them
   *  is the one assertion that means the same thing against a mocked space and against whatever real space the
   *  backend happens to hold. */
  const canvas = (page: import('@playwright/test').Page) => page.frameLocator('iframe').first();

  test('mounts and paints its first screen', async ({ page, capture }) => {
    await page.goto(subject.origin, { waitUntil: 'domcontentloaded' });

    const root = page.locator('#plitzi');
    await expect(root).toBeAttached();

    // An empty root means the bundle loaded and React never committed — the failure a screenshot alone would show
    // as a blank page with no explanation.
    await expect
      .poll(async () => root.evaluate(node => node.childElementCount), {
        message: 'the builder root stayed empty'
      })
      .toBeGreaterThan(0);

    await capture('boot');
  });

  test('renders the space it is editing', async ({ page, capture }) => {
    await page.goto(subject.origin, { waitUntil: 'domcontentloaded' });

    const elements = canvas(page).locator('[class*="plitzi-component__"]');

    await expect
      .poll(async () => elements.count(), {
        message: 'the canvas never rendered an element — the space loaded but nothing reached the DOM',
        timeout: 60_000
      })
      .toBeGreaterThan(0);

    // The editor around it has to be there too: a canvas with no chrome is the app half-mounted.
    await expect(page.getByText('Publish')).toBeVisible();

    await capture('space-rendered');
  });

  /** Against a mock the space is the suite's own, so its copy can be named. Against a live backend it is whatever
   *  that deployment holds, and asserting on the text would be asserting on somebody's content. */
  test('renders the mocked space, by name', async ({ page }) => {
    test.skip(!isMockBackend(), 'the live backend serves a space this spec knows nothing about');

    await page.goto(subject.origin, { waitUntil: 'domcontentloaded' });

    // By text, not by role: the builder wraps editable copy in its own element, so the heading a reader sees is
    // not a heading the accessibility tree reports.
    await expect(canvas(page).getByText('Welcome To Plitzi')).toBeVisible({ timeout: 60_000 });
    await expect(canvas(page).getByText('Explore the Plitzi playground')).toBeVisible();
  });
});
