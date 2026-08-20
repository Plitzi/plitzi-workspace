import { createHmac } from 'node:crypto';

import { describeTarget, expect, test } from '../../fixtures';
import { expectSampleSpaceContent, expectSpaceRendered } from '../../helpers/space';
import { expectVisuallyHealthy } from '../../helpers/visualHealth';
import { sampleSpace } from '../../spaces';

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

    await capture('no-build');
  });
});

describeTarget('render', subject => {
  test('render() shows the space with no server', async ({ page, capture }) => {
    await page.goto(subject.origin);

    await expectSampleSpaceContent(page);
    await expectSpaceRendered(page, sampleSpace());
    await expectVisuallyHealthy(page);

    await capture('render');
  });
});

describeTarget('react-component', subject => {
  test('<PlitziSdk> shows the space inside a host tree', async ({ page, capture }) => {
    await page.goto(subject.origin);

    await expectSampleSpaceContent(page);
    await expectVisuallyHealthy(page);

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
    const one = await request.get(`${subject.origin}/_rsc?location=%2F&ids=rsc-server`);

    expect(all.status()).toBe(200);
    expect(Object.keys(((await one.json()) as { serverData: object }).serverData)).toEqual(['rsc-server']);
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

describeTarget('server-actions', subject => {
  /** The published site is the target's own origin; the draft is the next port up. Same process, same space, same
   *  action store — the deployment record is the only thing that differs, which is what makes the pair a
   *  demonstration rather than two servers. */
  const draftOrigin = () => {
    const url = new URL(subject.origin);
    url.port = String(Number(url.port) + 1);

    return url.origin;
  };

  const call = { actionId: 'shipping-quote', input: { city: 'Berlin', weightKg: 2 } };

  test('a page runs the action and shows what came back', async ({ page, capture }) => {
    await page.goto(subject.origin);

    await expect(page.getByRole('heading', { name: 'Shipping quote' })).toBeVisible();
    await capture('before-the-run');

    await page.getByLabel('Destination city').fill('Berlin');
    await page.getByRole('button', { name: 'Get a quote' }).click();

    // The whole promise of the README: the browser sent a name and two values, and the answer is on the page.
    await expect(page.getByText('quoted by the copy published at revision 2')).toBeVisible();
    await capture('after-the-run');
  });

  test('the output step is the contract — what it did not name never leaves', async ({ request }) => {
    const response = await request.post(`${subject.origin}/_action`, { data: call });
    const { output } = (await response.json()) as { output: Record<string, unknown> };

    expect(response.status()).toBe(200);
    expect(Object.keys(output).sort()).toEqual(['currency', 'summary', 'total']);
    // The task returned it; no step named it. That is the mechanism, not an omission in the example.
    expect(output, 'the README says `band` stays on the server').not.toHaveProperty('band');
  });

  test('input the document did not declare is dropped', async ({ request }) => {
    const response = await request.post(`${subject.origin}/_action`, {
      data: { ...call, input: { ...call.input, discount: 'free' } }
    });
    const { output } = (await response.json()) as { output: { total: number } };

    expect(output.total, 'an undeclared key reached a step').toBe(8);
  });

  /** The rule the example exists to show: a page reads the version it was published with, and the draft is what
   *  its author is editing now. Both answers come from one action id and one process. */
  test('the published site and the draft answer with their own version', async ({ request }) => {
    const shipped = await request.post(`${subject.origin}/_action`, { data: call });
    const editing = await request.post(`${draftOrigin()}/_action`, { data: call });

    const shippedOutput = (await shipped.json()) as { output: { total: number; summary: string } };
    const editingOutput = (await editing.json()) as { output: { total: number; summary: string } };

    expect(shippedOutput.output.summary).toContain('published at revision 2');
    expect(editingOutput.output.summary).toContain('draft');
    expect(shippedOutput.output.total, 'both revisions quoted the same price').not.toBe(editingOutput.output.total);
  });

  test('the webhook takes a signed delivery and refuses an unsigned one', async ({ request }) => {
    const body = JSON.stringify({ event: 'page_view' });
    const signature = createHmac('sha256', 'example-webhook-secret').update(body).digest('hex');
    const hook = `${subject.origin}/_action/hook/visit-digest`;
    const headers = { 'content-type': 'application/json' };

    const signed = await request.post(hook, { headers: { ...headers, 'x-example-signature': signature }, data: body });
    const unsigned = await request.post(hook, { headers, data: body });

    expect(signed.status()).toBe(200);
    expect((await signed.json()) as { accepted: boolean }).toMatchObject({ accepted: true });
    expect(unsigned.status(), 'an unsigned delivery ran the flow').toBe(401);
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
