import { describeTarget, expect, test } from '../../fixtures';
import { expectPageWhole } from '../../helpers/harness';
import { boardJob, callAction } from '../../helpers/schedules';
import { expectDevToolsAvailable, expectSampleSpaceContent, RSC_IDS, WITHOUT_RSC } from '../../helpers/space';
import { expectVisuallyHealthy } from '../../helpers/visualHealth';
import { PORTS } from '../../launchConfig';
import { sampleAuthored } from '../../spaces';

import type { APIRequestContext } from '@playwright/test';

/** The examples are written for a person, not for this suite: each one shows a single wiring decision and stops.
 *  So this category does not test Plitzi through them — the other categories do that, against surfaces the suite
 *  owns. What it checks is narrower and more important: **the example still does what its own README says**.
 *
 *  A reader who follows the docs and gets a blank page is a reader who leaves. That is the whole failure mode
 *  guarded here, one example at a time. */

describeTarget('no-build', subject => {
  test('a static HTML file shows the space', async ({ page, capture }) => {
    await page.goto(subject.origin);

    await expectSampleSpaceContent(page);
    await expectVisuallyHealthy(page);
    await expectDevToolsAvailable(page);

    await capture('no-build');
  });
});

describeTarget('render', subject => {
  test('render() shows the space with no server', async ({ page, capture }) => {
    await page.goto(subject.origin);

    await expectSampleSpaceContent(page);
    await expectPageWhole(page, sampleAuthored(), { elements: 'all', ...WITHOUT_RSC });
    await expectDevToolsAvailable(page);

    await capture('render');
  });
});

describeTarget('react-component', subject => {
  test('<PlitziSdk> shows the space inside a host tree', async ({ page, capture }) => {
    await page.goto(subject.origin);

    await expectSampleSpaceContent(page);
    await expectVisuallyHealthy(page);
    await expectDevToolsAvailable(page);

    await capture('react-component');
  });

  /** The README promises the space behaves like any other child — the two things it says you can do with it. */
  test('unmounts and mounts again with the host', async ({ page }) => {
    await page.goto(subject.origin);
    await expect(page.getByRole('heading', { name: 'Welcome To Plitzi' })).toBeVisible();

    await page.getByRole('button', { name: 'Unmount Plitzi' }).click();
    await expect(page.getByText('Plitzi is unmounted.')).toBeVisible();

    await page.getByRole('button', { name: 'Mount Plitzi' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome To Plitzi' })).toBeVisible();
  });
});

describeTarget('server-rendered', subject => {
  test('the server sends the space in the HTML', async ({ request }) => {
    const html = await (await request.get(subject.origin)).text();

    expect(html, 'the README promises a server-rendered page').toContain('Welcome To Plitzi');
  });

  test('and it hydrates into a working page', async ({ page, capture }) => {
    await page.goto(subject.origin);

    await expectSampleSpaceContent(page);
    await expectVisuallyHealthy(page);

    await capture('server-rendered');
  });
});

describeTarget('server-components', subject => {
  /** The README's claim is per-element server data. Both halves have to be there: the data, and a component to
   *  render it — an example that ships only the first renders an empty section and reports nothing. */
  test('the RSC elements are on the page, showing server data', async ({ page, capture }) => {
    await page.goto(subject.origin);

    await expect(page.getByText('Server Info — runtime: "server"')).toBeVisible();
    await expect(page.getByText('Client Info — runtime: "client"')).toBeVisible();
    await expect(page.getByText('Shared Info — runtime: "shared"', { exact: false })).toBeVisible();
    await expect(page.getByText('Rendered on the server')).toBeVisible();

    await expectVisuallyHealthy(page);

    await capture('server-components');
  });

  test('the endpoint the README documents answers', async ({ request }) => {
    const all = await request.get(`${subject.origin}/_rsc?location=%2F`);
    const one = await request.get(`${subject.origin}/_rsc?location=%2F&ids=${RSC_IDS.server}`);

    expect(all.status()).toBe(200);
    expect(Object.keys(((await one.json()) as { serverData: object }).serverData)).toEqual([RSC_IDS.server]);
  });
});

describeTarget('sessions', subject => {
  test('sign in, see who you are, sign out', async ({ page, capture }) => {
    await page.goto(subject.origin);

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await capture('signed-out');

    await page.getByLabel('Username').fill('ada');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('heading', { name: 'ada' })).toBeVisible();
    await expect(page.getByText('ada@example.test')).toBeVisible();
    await capture('signed-in');

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
});

describeTarget('mysql', subject => {
  test('the same two pages, over a real database', async ({ page }) => {
    await page.goto(subject.origin);

    await page.getByLabel('Username').fill('ada');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('heading', { name: 'ada' })).toBeVisible();
  });
});

describeTarget('server-actions-no-server', subject => {
  /** The example exists for one assertion, and this is it: with no server tier, the server-side halves of a page
   *  do not TRY. Not a failed request that is handled quietly — no request at all. */
  test('nothing is asked of a server that is not there', async ({ page, capture }) => {
    const attempts: string[] = [];
    page.on('request', request => {
      const { pathname } = new URL(request.url());
      if (pathname.includes('_action') || pathname.includes('_rsc')) {
        attempts.push(request.url());
      }
    });

    await page.goto(subject.origin);
    await expect(page.getByRole('heading', { name: 'The same page, with nobody to ask' })).toBeVisible();

    // The provider is a `runtime: 'server'` element with nowhere to resolve from, so it renders its mock.
    await expect(page.locator('img.catPhoto')).toHaveCount(2);

    await page.getByRole('button', { name: 'Fetch new cats' }).click();

    // A skipped run is a RESULT: the flow carried on and the next step put the status on the page.
    await expect(page.getByText('The step reported: skipped')).toBeVisible();
    expect(attempts, 'a step called a server this page does not have').toEqual([]);

    await capture('no-server-tier');
  });
});

describeTarget('server-actions-schedules', subject => {
  const call = (request: APIRequestContext, actionId: string, input: Record<string, unknown>) =>
    callAction(request, subject.origin, actionId, input);

  const job = (request: APIRequestContext, jobId: string) => boardJob(request, subject.origin, jobId);

  test('the page arrives with the schedules already in it, in UTC and in the zone they were written in', async ({
    request
  }) => {
    const html = await (await request.get(subject.origin)).text();

    expect(html).toContain('Minute heartbeat');
    // A 9am Madrid digest reads as nine — beside the UTC instant every replica agrees on. It runs on working days, so
    // seen from a weekend it is more than a day out and both sides carry the date as well.
    expect(html).toMatch(/\d{2}:00 UTC \((?:[^)]*, )?09:00 Europe\/Madrid\)/);
    // Switched off, and still on the board: a missing row could not say so.
    expect(html).toContain('switched off');
  });

  test('a reminder queued from the page runs when it comes due, and the board shows it without a reload', async ({
    page,
    capture
  }) => {
    await page.goto(subject.origin);
    // What is typed before the page hydrates is the server's markup, which hydration takes back.
    await expect(page.locator('[data-hydrated]')).toHaveCount(1);
    await page.getByLabel('Remind me to').fill('Water the plants');
    await page.getByLabel('In how many seconds').fill('3');
    await page.getByRole('button', { name: 'Queue the reminder' }).click();

    await expect(page.getByText('Queued “Reminder” — due in 3s')).toBeVisible();

    // The banner on top counts down while the job waits, and turns to "it is time" once a worker has run it.
    const banner = page.locator('.reminderBanner');
    await expect(banner).toContainText('⏰ Water the plants');
    await expect(banner).toHaveClass(/reminderBanner--pending/);
    await capture('reminder-queued');

    // Nobody reloads: `refreshSeconds` asks the server for the board again until the job has run.
    await expect(banner).toHaveClass(/reminderBanner--fresh/, { timeout: 15_000 });
    await expect(banner).toContainText('It is time');
    await expect(page.getByText('Reminder: Water the plants')).toBeVisible();
    await capture('reminder-ran');
  });

  // Out of attempts a job is set aside for somebody to look at, not dropped: what failed may be fixed, then resumed.
  test('a failing job is retried with a backoff, is set aside, and says which step failed', async ({ request }) => {
    const { body } = await call(request, 'start-flaky', { failures: 99 });

    await expect.poll(async () => (await job(request, body.output.jobId))?.status, { timeout: 30_000 }).toBe('paused');

    const setAside = await job(request, body.output.jobId);
    expect(setAside?.error).toContain('Set aside after 3 failed attempts');
    expect(setAside?.error).toContain('step "sync" failed: The upstream refused attempt 3');
    expect(setAside?.history).toContain('#3 failed');
  });

  test('a running job stops when it is cancelled', async ({ request }) => {
    const { body } = await call(request, 'start-export', { seconds: 20 });
    await expect.poll(async () => (await job(request, body.output.jobId))?.status, { timeout: 10_000 }).toBe('running');

    expect((await call(request, 'job-cancel', { jobId: body.output.jobId })).status).toBe(200);

    // The worker reads the flag at its next heartbeat — a third of the ten-second lease.
    await expect
      .poll(async () => (await job(request, body.output.jobId))?.status, { timeout: 10_000 })
      .toBe('cancelled');
  });

  test('a job that finished runs again from the board, keeping its history', async ({ request }) => {
    const { body } = await call(request, 'start-flaky', { failures: 0 });
    await expect
      .poll(async () => (await job(request, body.output.jobId))?.status, { timeout: 10_000 })
      .toBe('succeeded');

    expect((await call(request, 'job-retry', { jobId: body.output.jobId })).status).toBe(200);

    await expect
      .poll(async () => (await job(request, body.output.jobId))?.history, { timeout: 10_000 })
      .toBe(`#1 succeeded on replica-${String(PORTS.schedules)} · #2 succeeded on replica-${String(PORTS.schedules)}`);
  });

  // The README's claim about the queued actions: only a job can start them. A page naming one is refused.
  test('a page cannot run a queued action directly', async ({ request }) => {
    const { status } = await call(request, 'reminder', { message: 'skip the queue' });

    expect(status).toBe(403);
  });
});

describeTarget('mcp-server', subject => {
  test('an agent can connect to it', async ({ request }) => {
    const response = await request.post(subject.origin, {
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'plitzi-e2e', version: '0.0.0' }
        }
      }
    });

    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('protocolVersion');
  });
});

describeTarget('ssr-preview', subject => {
  test('serves pages and MCP from one port', async ({ page, request }) => {
    await page.goto(subject.origin);
    await expectSampleSpaceContent(page);

    const rpc = await request.post(`${subject.origin}/mcp`, {
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'plitzi-e2e', version: '0.0.0' }
        }
      }
    });

    expect(rpc.status()).toBe(200);
  });

  /** Exactly the command the README prints, asserted the way the README asserts it. */
  test('the draft-preview curl in the README works', async ({ request }) => {
    const minted = await request.post(`${subject.origin}/__preview`, {
      headers: { 'content-type': 'application/json', 'x-preview-secret': 'example-secret' },
      data: { spaceId: 1, operations: [{ type: 'patchSettings', settings: { title: 'Draft title' } }] }
    });

    expect(minted.status()).toBe(200);

    const { token } = (await minted.json()) as { token: string };
    const drafted = await (await request.get(`${subject.origin}/?__pt=${token}`)).text();
    const afterwards = await (await request.get(`${subject.origin}/?__pt=${token}`)).text();

    expect(drafted, 'the README says this render carries the draft').toContain('Draft title');
    expect(afterwards, 'the README says the token is one-shot').not.toContain('Draft title');
  });
});

describeTarget('runtime', subject => {
  /** The README's three promises: the page counts through the runtime's task, the count is a route too, and the pulse
   *  is a stream held open — each answered by the one module the platform would run beside a space. */
  test('the page shows the count and a visit adds one, through the runtime’s own task', async ({ page }) => {
    await page.goto(subject.origin);
    // A button clicked before the page hydrates is the server's markup, and does nothing.
    await expect(page.locator('[data-hydrated]')).toHaveCount(1);
    const count = page.locator('[data-plitzi-el="visits-count"]');
    await expect(count).toHaveText(/^\d+ visits so far$/);
    const before = Number.parseInt((await count.textContent()) ?? '', 10);

    await page.getByRole('button', { name: 'Count me' }).click();

    await expect(count).toHaveText(`${String(before + 1)} visits so far`);
  });

  test('the count is a route as well, under /fn/', async ({ request }) => {
    const answer = (await (await request.get(`${subject.origin}/fn/visits`)).json()) as { visits: number };

    expect(answer.visits).toBeGreaterThanOrEqual(0);
  });

  test('the pulse is a stream held open, saying who is listening', async () => {
    const controller = new AbortController();
    const response = await fetch(`${subject.origin}/pulse`, { signal: controller.signal });

    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const reader = response.body?.getReader();
    const first = new TextDecoder().decode((await reader?.read())?.value);
    controller.abort();

    expect(JSON.parse(first.replace(/^data: /, ''))).toMatchObject({ listening: 1 });
  });
});

/** The README's promise, both ways round: the page is the page server's, the press is the worker's — and the page
 *  server runs none of it. Which process answered is read off where the browser sent the call. */
const pressesOnAWorker = (id: string, callsAt: (subject: { origin: string }) => string) => {
  describeTarget(id, subject => {
    test('a press runs on the worker, and the page shows what it answered', async ({ page }) => {
      const calls: string[] = [];
      page.on('request', request => {
        if (request.method() === 'POST') {
          calls.push(request.url());
        }
      });
      await page.goto(subject.origin);
      // A button clicked before the page hydrates is the server's markup, and does nothing.
      await expect(page.locator('[data-hydrated]')).toHaveCount(1);
      await expect(page.getByText('No presses yet')).toBeVisible();
      const count = page.locator('[data-plitzi-el="press-count"]');

      await page.getByRole('button', { name: 'Press' }).click();
      await expect(count).toHaveText(/^Presses so far: \d+$/);
      const first = Number.parseInt((await count.textContent())?.replace('Presses so far: ', '') ?? '', 10);
      await page.getByRole('button', { name: 'Press' }).click();

      await expect(count).toHaveText(`Presses so far: ${String(first + 1)}`);
      expect(calls).toEqual([callsAt(subject), callsAt(subject)]);
    });
  });
};

pressesOnAWorker('actions-on-a-worker', subject => `${subject.origin}/_action`);
pressesOnAWorker('actions-on-another-origin', () => `http://127.0.0.1:${String(PORTS.elsewhereWorker)}/_action`);

describeTarget('actions-on-another-origin', () => {
  test('the worker answers its pages’ origin alone', async ({ request }) => {
    const worker = `http://127.0.0.1:${String(PORTS.elsewhereWorker)}/_action`;
    const from = (origin: string) =>
      request.post(worker, {
        headers: { origin, 'sec-fetch-site': 'cross-site' },
        data: { actionId: 'press', input: {} }
      });

    const own = await from(`http://127.0.0.1:${String(PORTS.elsewherePages)}`);
    const foreign = await from('https://elsewhere.example');

    expect(own.status()).toBe(200);
    expect(own.headers()['access-control-allow-origin']).toBe(`http://127.0.0.1:${String(PORTS.elsewherePages)}`);
    expect(foreign.status()).toBe(403);
  });
});
