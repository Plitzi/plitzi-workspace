import { describeTarget, expect, test } from '../../fixtures';
import { element, expectSharedSpace, RSC_NODE_IDS } from '../../helpers/sharedSpace';
import { expectVisuallyHealthy } from '../../helpers/visualHealth';

describeTarget('server-components', subject => {
  test('renders the RSC elements the other examples cannot', async ({ page, capture }) => {
    await page.goto(subject.origin);

    await expectSharedSpace(page);

    for (const id of RSC_NODE_IDS) {
      await expect(element(page, id), `${id} did not render`).toBeVisible();
    }

    await expect(page.getByText('Rendered on the server')).toBeVisible();

    await expectVisuallyHealthy(page);

    await capture('server-components');
  });

  test('serves every slice, and only the slice asked for', async ({ request }) => {
    const all = await request.get(`${subject.origin}/_rsc?location=%2F`);
    expect(all.status()).toBe(200);

    const everything = (await all.json()) as { serverData: Record<string, unknown> };
    expect(Object.keys(everything.serverData).sort()).toEqual(['rsc-server', 'rsc-shared']);

    const one = await request.get(`${subject.origin}/_rsc?location=%2F&ids=rsc-server`);
    const single = (await one.json()) as { serverData: Record<string, unknown> };

    expect(Object.keys(single.serverData), 'a partial refresh rebuilt slices nobody asked for').toEqual(['rsc-server']);
  });
});
