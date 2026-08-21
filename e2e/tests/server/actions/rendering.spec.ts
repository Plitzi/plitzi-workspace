import { describeTarget, expect, test } from '../../../fixtures';
import { ACTION_IDS, ACTION_OUTPUT } from '../../../spaces';

/** A page whose server elements are fed by ACTIONS, on a server that has nothing else: no connectors, no
 *  `getRscData` of its own, no plugins.
 *
 *  Both things asserted here were once broken in a way no configuration could reveal — the section simply came
 *  back empty — which is why they are checked against a surface the suite owns rather than only through an
 *  example that needs the internet to say anything. */

describeTarget('action-server', subject => {
  /** Read off the RENDERED paragraph, not the page: the payload the client is seeded with carries the same
   *  string, so `includes` would pass on a page whose section never rendered. */
  const rendered = new RegExp(`data-id="${ACTION_IDS.title}"[^>]*>${ACTION_OUTPUT.title}<`);
  const slice = (html: string) => rendered.test(html);

  /** The endpoint that resolves server elements is assembled from whatever can produce their data. Keyed on
   *  connectors alone, a space that has none — an ordinary one, since actions are the read a manifest cannot
   *  express — rendered its providers empty with nothing missing anywhere. */
  test('an action feeds a server element on a deployment with no connectors', async ({ request }) => {
    const html = await (await request.get(subject.origin)).text();

    expect(html, 'the action-fed section was empty').toMatch(rendered);
    expect(html).toMatch(new RegExp(`data-id="${ACTION_IDS.who}"[^>]*>${ACTION_OUTPUT.who}<`));
  });

  test('the RSC endpoint exists because the actions do', async ({ request }) => {
    const response = await request.get(`${subject.origin}/_rsc?location=%2F&ids=${ACTION_IDS.provider}`);
    const { serverData } = (await response.json()) as { serverData: Record<string, Record<string, unknown>> };

    expect(response.status()).toBe(200);
    expect(serverData[ACTION_IDS.provider]).toEqual(ACTION_OUTPUT);
  });

  /** The trigger's input contract, reached from the URL: the page wires nothing up for it. */
  test('the page context reaches the action as input', async ({ request }) => {
    const html = await (await request.get(`${subject.origin}/?who=carlos`)).text();

    expect(html).toMatch(new RegExp(`data-id="${ACTION_IDS.who}"[^>]*>carlos<`));
  });

  /** The one that needs several at once. Single-flight refuses a second run holding the same key, and every
   *  anonymous render of one URL derives the SAME key — so before each render got a key of its own, whichever
   *  ones arrived while the first was still running had their section refused as a duplicate. The action holds a
   *  run for 250ms, so four requests in flight together really are together. */
  test('concurrent renders of the same page all get their section', async ({ request }) => {
    const pages = await Promise.all([0, 1, 2, 3].map(async () => (await request.get(subject.origin)).text()));

    expect(pages.filter(slice), 'a render lost its section to another visitor').toHaveLength(pages.length);
  });

  /** The other half of "an element names ONE producer": this one names a connector the deployment cannot read.
   *  It must cost that element and nothing else — the page renders, and the action-fed section is untouched. */
  test('an element naming a producer this deployment does not have costs only itself', async ({ page, capture }) => {
    await page.goto(subject.origin);

    await expect(page.locator(`[data-id="${ACTION_IDS.title}"]`)).toHaveText(ACTION_OUTPUT.title);
    await expect(page.locator(`[data-id="${ACTION_IDS.orphanText}"]`)).toHaveText('');

    await capture('actions-feed-a-page');
  });
});

test.describe.configure({ mode: 'parallel' });
