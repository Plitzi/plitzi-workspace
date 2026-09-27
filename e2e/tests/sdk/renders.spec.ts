import { inspectRenders, pressShortcut } from '@plitzi/sdk-authoring';

import { describeTarget, expect, test } from '../../fixtures';
import { el, openHarness, renderSpace } from '../../helpers/harness';
import { RENDERS_IDS, rendersSpace } from '../../spaces';

/** What an interaction renders, counted by the SDK's own tracing: the elements that read what changed, and no more. */

const shown = (page: Parameters<typeof el>[0], id: string) => el(page, rendersSpace(), id);

describeTarget('harness', () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
    await renderSpace(page, rendersSpace(), { debugMode: true });
    await expect(shown(page, `${RENDERS_IDS.picked}-0`)).toHaveText('a, b');
  });

  test('a click renders what reads the value it wrote, not the page', async ({ page }) => {
    const report = await inspectRenders(page, () => shown(page, RENDERS_IDS.bump).click(), { max: 4 });

    await expect(shown(page, RENDERS_IDS.count)).toHaveText('1');
    expect(report.problems).toEqual([]);
    expect(report.elements.map(element => element.id)).toContain(RENDERS_IDS.count);
    // Every computed value was evaluated again; the list came out the same, so nothing reading it rendered.
    expect(report.elements.filter(element => element.id.startsWith(RENDERS_IDS.picked))).toEqual([]);
    expect(report.causes).toContain('runtime.state.count');
  });

  test('a shortcut is pressed with the keys the page listens for', async ({ page }) => {
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    const report = await inspectRenders(page, () => pressShortcut(page, 'mod+k'), { max: 4 });

    await expect(shown(page, RENDERS_IDS.other)).toHaveText('pressed');
    expect(report.problems).toEqual([]);
  });

  test('a page without tracing says how to turn it on', async ({ page }) => {
    await renderSpace(page, rendersSpace());

    await expect(inspectRenders(page, () => Promise.resolve())).rejects.toThrow(/debugMode/);
  });
});
