import { describeTarget, expect, test } from '../../../fixtures';
import { ACTION_IDS, ACTION_OUTPUT, PROVIDER_ERROR } from '../../../spaces';

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
    expect(serverData[ACTION_IDS.provider]).toMatchObject(ACTION_OUTPUT);
  });

  /** The trigger's input contract, reached from the URL: the page wires nothing up for it. */
  test('the page context reaches the action as input', async ({ request }) => {
    const html = await (await request.get(`${subject.origin}/?who=carlos`)).text();

    expect(html).toMatch(new RegExp(`data-id="${ACTION_IDS.who}"[^>]*>carlos<`));
  });

  /**
   * The one that needs several at once, and the two ways a page under load used to lose its sections.
   *
   * Single-flight refuses a second run holding the same key, and every anonymous render of one URL derives the
   * SAME key — so before each render got a key of its own, whichever ones arrived while the first was running
   * were refused as duplicates. And renders drew on the per-space CALL budget, ten by default: sixteen at once
   * is over it on purpose, because a page with sixteen simultaneous readers is a page doing well.
   *
   * The action holds its run for 250ms, so these really are in flight together.
   */
  test('a page read by many visitors at once serves every one of them', async ({ request }) => {
    // Each visitor asks a different question, so none of them can be answered by another's run: sixteen real
    // renders at once, which is over the per-space CALL budget on purpose.
    const visitors = Array.from({ length: 16 }, (_, index) => `visitor-${index}`);
    const pages = await Promise.all(
      visitors.map(async who => (await request.get(`${subject.origin}/?who=${who}`)).text())
    );

    expect(pages.filter(slice), 'a render lost its section to another visitor').toHaveLength(pages.length);
    expect(
      pages.filter(page => page.includes('visitor-15')),
      'a visitor got somebody else’s answer'
    ).toHaveLength(1);
  });

  /**
   * The same question asked by many people at once is answered once.
   *
   * Without it, a thousand visitors of one URL are a thousand identical flows hitting whatever the action reads
   * in the same instant — the stampede that takes down the thing being read, not the thing reading it.
   */
  test('visitors asking the same thing at the same time share one run', async ({ request }) => {
    const runIds = await Promise.all(
      Array.from({ length: 12 }, async () => {
        const response = await request.get(`${subject.origin}/_rsc?location=%2F&ids=${ACTION_IDS.provider}`);
        const { serverData } = (await response.json()) as { serverData: Record<string, { run: string }> };

        return serverData[ACTION_IDS.provider].run;
      })
    );

    expect(new Set(runIds).size, 'the same page was built from scratch for every visitor').toBe(1);
  });

  /** The server is up; what it cannot reach is the rest of the world. The action's own `http.request` resolves
   *  nowhere, so the run fails — and a page must not fail with it: the slice is left out, the element says it
   *  could not be reached, and every other section renders exactly as it would have. */
  test('an action whose own call cannot leave the machine costs its section and nothing else', async ({
    page,
    capture
  }) => {
    await page.goto(subject.origin);

    await expect(page.locator(`[data-id="${ACTION_IDS.offlineText}"]`)).toHaveText(PROVIDER_ERROR);
    await expect(page.locator(`[data-id="${ACTION_IDS.title}"]`)).toHaveText(ACTION_OUTPUT.title);

    await capture('outbound-call-failed');
  });

  test('the failed slice is absent from the payload rather than empty in it', async ({ request }) => {
    const response = await request.get(`${subject.origin}/_rsc?location=%2F`);
    const { serverData } = (await response.json()) as { serverData: Record<string, unknown> };

    expect(response.status(), 'one element failing took the whole payload down').toBe(200);
    expect(serverData).toHaveProperty(ACTION_IDS.provider);
    expect(Object.keys(serverData), 'a failed slice was published as empty data').not.toContain(ACTION_IDS.offline);
  });

  /** The other half of "an element names ONE producer": this one names a connector the deployment cannot read.
   *  It must cost that element and nothing else — the page renders, and the action-fed section is untouched. */
  /**
   * The budget is the PAGE's, and it wins over the producer's own.
   *
   * This action is allowed two seconds of its own and the deployment gives a section 800ms, so the page is
   * answered without it — and, since the budget now cancels what it stops waiting for, the run ends there too
   * rather than finishing for a page that has already been sent.
   */
  test('a section slower than the page will wait for is dropped, on the page’s terms', async ({ page, capture }) => {
    const startedAt = Date.now();
    await page.goto(`${subject.origin}/slow`);

    await expect(page.locator(`[data-id="${ACTION_IDS.slowText}"]`)).toHaveText(PROVIDER_ERROR);
    expect(Date.now() - startedAt, 'the page waited for the action instead of for its own budget').toBeLessThan(2_000);

    await capture('section-over-budget');
  });

  test('an element naming a producer this deployment does not have costs only itself', async ({ page, capture }) => {
    await page.goto(subject.origin);

    await expect(page.locator(`[data-id="${ACTION_IDS.title}"]`)).toHaveText(ACTION_OUTPUT.title);
    await expect(page.locator(`[data-id="${ACTION_IDS.orphanText}"]`)).toHaveText('');

    await capture('actions-feed-a-page');
  });

  test('a click runs the action and the step reports what came back', async ({ page }) => {
    await page.goto(subject.origin);
    await page.getByRole('button', { name: 'Run it' }).click();

    await expect(page.locator(`[data-id="${ACTION_IDS.status}"]`)).toHaveText('completed');
  });

  /** The server was there when the page loaded and is not there now — a deploy, a restart, a dropped connection.
   *  The request REJECTS rather than answering, which is the case that used to leave the step throwing: the flow
   *  stopped with nothing to bind and the page kept its last state, looking like a button that does nothing. */
  test.describe('with the server gone', () => {
    // The browser's own report of the abort this test asks for, and nothing else: an aborted request is logged by
    // Chromium as a console error before any of our code sees it.
    test.use({ allowedConsoleErrors: [/net::ERR_FAILED/] });

    test('is reported as a failed run, not as a dead button', async ({ page, capture }) => {
      await page.goto(subject.origin);
      await expect(page.locator(`[data-id="${ACTION_IDS.title}"]`)).toHaveText(ACTION_OUTPUT.title);

      await page.route('**/_action', route => route.abort());
      await page.getByRole('button', { name: 'Run it' }).click();

      await expect(page.locator(`[data-id="${ACTION_IDS.status}"]`)).toHaveText('failed');
      // The rest of the page is untouched: what the server already rendered does not evaporate with it.
      await expect(page.locator(`[data-id="${ACTION_IDS.title}"]`)).toHaveText(ACTION_OUTPUT.title);

      await capture('server-went-away');
    });
  });
});

test.describe.configure({ mode: 'parallel' });
