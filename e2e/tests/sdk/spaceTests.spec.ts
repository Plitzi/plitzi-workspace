import { e2e, e2eResultText, runE2eTest } from '@plitzi/sdk-authoring';

import { describeTarget, expect, test } from '../../fixtures';
import { HARNESS_ORIGIN, openHarness, renderSpace } from '../../helpers/harness';
import { KEPT_IDS, keptStateSpace } from '../../spaces';

/**
 * A space's e2e tests (RFC 0031) run by sdk-authoring's runner in a real browser: its steps pressed on the space the
 * SDK draws, its expectations held — and a failed one said with what it read, the steps after it not run.
 */

const open = async (page: Parameters<typeof openHarness>[0]): Promise<void> => {
  await openHarness(page);
  await renderSpace(page, keptStateSpace());
};

describeTarget('harness', () => {
  test('plays a visitor’s steps and holds what must be true after them', async ({ page }) => {
    const result = await runE2eTest(
      page,
      e2e.test({
        id: 'saves-favourite',
        title: 'Saving a favourite shows it',
        page: '/',
        steps: [
          e2e.expectText(KEPT_IDS.keptText, 'none', { exact: true }),
          e2e.click(KEPT_IDS.keep),
          e2e.expectText(KEPT_IDS.keptText, 'saved', { exact: true }),
          e2e.expectShown(KEPT_IDS.draftText)
        ]
      }),
      { origin: HARNESS_ORIGIN, open: () => open(page) }
    );

    expect(e2eResultText(result).slice(1)).toEqual([
      '  ✓ kept-text reads "none"',
      '  ✓ click kept-keep',
      '  ✓ kept-text reads "saved"',
      '  ✓ kept-draft-text shown'
    ]);
    expect(result.ok).toBe(true);
  });

  test('stops at the first expectation that does not hold, saying what it read', async ({ page }) => {
    const result = await runE2eTest(
      page,
      e2e.test({
        id: 'wrong-word',
        title: 'Expects a word the page never shows',
        page: '/',
        steps: [
          e2e.click(KEPT_IDS.draft),
          e2e.expectText(KEPT_IDS.draftText, 'drafted', { exact: true }),
          e2e.click(KEPT_IDS.keep)
        ]
      }),
      { origin: HARNESS_ORIGIN, open: () => open(page), expectMs: 1000 }
    );

    expect(result.ok).toBe(false);
    expect(e2eResultText(result).slice(1)).toEqual([
      '  ✓ click kept-draft',
      '  ✗ kept-draft-text reads "drafted" — it reads "typed"',
      '  · click kept-keep — not run'
    ]);
  });
});
