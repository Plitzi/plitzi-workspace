import { describeTarget, expect, test } from '../../fixtures';

/** The builder is the one surface here that talks to a real backend, so this stays a boot check rather than a tour:
 *  it proves the app mounts, paints and reaches its first screen without throwing. Flows that need an account
 *  belong in a spec that is given one — this is what can be asserted from a clean machine.
 *
 *  Gated behind PLITZI_E2E_BUILDER because it needs `app.plitzi.local` resolving locally. */
describeTarget('builder', subject => {
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
});
