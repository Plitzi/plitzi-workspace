import { describeTarget, expect, test } from '../../../fixtures';
import { RSC_IDS } from '../../../helpers/space';

type RscResponse = { serverData: Record<string, unknown> };

describeTarget('server', subject => {
  test('serves every slice for a page', async ({ request }) => {
    const response = await request.get(`${subject.origin}/_rsc?location=%2F`);

    expect(response.status()).toBe(200);
    expect(Object.keys(((await response.json()) as RscResponse).serverData).sort()).toEqual(
      [RSC_IDS.server, RSC_IDS.shared].sort()
    );
  });

  /** `ids` is what a partial refresh sends. An adapter that ignores it rebuilds every slice to answer a request
   *  for one — correct output, and the cost the whole mechanism exists to avoid. */
  test('rebuilds only the slice a partial refresh asks for', async ({ request }) => {
    const response = await request.get(`${subject.origin}/_rsc?location=%2F&ids=${RSC_IDS.server}`);

    expect(Object.keys(((await response.json()) as RscResponse).serverData)).toEqual([RSC_IDS.server]);
  });

  test('ignores an id no element claims', async ({ request }) => {
    const response = await request.get(`${subject.origin}/_rsc?location=%2F&ids=not-an-element`);

    expect(response.status()).toBe(200);
    expect(((await response.json()) as RscResponse).serverData).toEqual({});
  });
});
