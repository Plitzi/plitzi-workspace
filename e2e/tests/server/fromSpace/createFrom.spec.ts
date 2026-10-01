import { describeTarget, expect, test } from '../../../fixtures';
import { TALLY_IDS } from '../../../spaces';

/**
 * `plitzi create --from`: a space on a platform, taken out as a project that serves it alone (docs/en/projects-from-spaces.md). The project is
 * the one the CLI wrote, started as its README says — see `server/fromSpaceServer.ts` — and every part of the space has
 * to be there with nothing of the platform's behind it.
 */

type ActionRun = { status: string; output: { count: number } };

describeTarget('from-space-server', subject => {
  test('renders its pages on the server, with its plugin rebuilt from source and its files served by itself', async ({
    page,
    request
  }) => {
    const html = await (await request.get(subject.origin)).text();
    expect(html, 'the plugin is server-rendered: its markup is in the HTML').toContain('Hello from the plugin');

    await page.goto(subject.origin);

    await expect(page.getByRole('heading', { name: 'Tally board' })).toBeVisible();
    await expect(page.locator(`[data-plitzi-el="${TALLY_IDS.counter}"]`)).toContainText('Visits');
    // The plugin and the runtime import one file: the snapshot carried it, and the project builds it into both.
    await expect(page.locator(`[data-plitzi-el="${TALLY_IDS.counter}"]`)).toContainText('Hello from the plugin');

    // Where the platform's CDN served it, the project serves its own copy: from its root, loaded.
    const dot = page.getByRole('img', { name: 'Dot' });
    await expect(dot).toHaveAttribute('src', '/assets/dot.svg');
    await expect.poll(() => dot.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(32);
  });

  test('runs its runtime in its own process', async ({ request }) => {
    const answer = await request.get(`${subject.origin}/hello`);

    expect(answer.status()).toBe(200);
    expect(await answer.json()).toEqual({ greeting: 'Hello from the runtime' });
  });

  test('runs its action, written back as code, on its own function and kv', async ({ request }) => {
    const call = async (): Promise<ActionRun> =>
      (await (
        await request.post(`${subject.origin}/_action`, { data: { actionId: 'tally-add', input: {} } })
      ).json()) as ActionRun;

    const first = await call();
    const second = await call();

    expect(first.status).toBe('completed');
    expect(second.output.count).toBe(first.output.count + 1);
  });
});
