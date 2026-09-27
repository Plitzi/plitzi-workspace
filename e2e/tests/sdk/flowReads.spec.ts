import { describeTarget, expect, test } from '../../fixtures';
import { el, openHarness, renderSpace } from '../../helpers/harness';
import { FLOW_READS_IDS, FLOW_READS_WAIT_MS, flowReadsSpace } from '../../spaces';

import type { Page } from '@playwright/test';

/**
 * What a flow's step reads: the page as it is when the step runs, in a real browser — where `state` reaches the page's
 * sources only after React renders, so reading them as they were copied could still show the value from before.
 */

const shown = (page: Page, id: string) => el(page, flowReadsSpace(), id);

describeTarget('harness', () => {
  test('each step reads the page as it is when it runs', async ({ page, step }) => {
    await openHarness(page);
    await renderSpace(page, flowReadsSpace());

    await step('a step reads what the step before it wrote', async () => {
      await shown(page, FLOW_READS_IDS.write).click();
      await expect(shown(page, FLOW_READS_IDS.written)).toHaveText('written');
    });

    await step('a computed value is evaluated over that write', async () => {
      await shown(page, FLOW_READS_IDS.compute).click();
      await expect(shown(page, FLOW_READS_IDS.computed)).toHaveText('6');
    });

    await step('a condition after a wait sees what somebody did meanwhile', async () => {
      await shown(page, FLOW_READS_IDS.start).click();
      await shown(page, FLOW_READS_IDS.cancel).click();
      await page.waitForTimeout(FLOW_READS_WAIT_MS + 500);
      await expect(shown(page, FLOW_READS_IDS.outcome)).toHaveText('none');
    });

    await step('and runs when nobody did', async () => {
      await shown(page, FLOW_READS_IDS.start).click();
      await expect(shown(page, FLOW_READS_IDS.outcome)).toHaveText('ran', { timeout: FLOW_READS_WAIT_MS + 3000 });
    });
  });
});
