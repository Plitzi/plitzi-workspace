import { createHmac } from 'node:crypto';

import { describeTarget, expect, test } from '../../fixtures';
import { paintTrace, resetPaint, watchPaint } from '../../helpers/flicker';
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

describeTarget('server-actions-render', subject => {
  /** The claim on the box: the pictures are IN the document. Fetched with no JavaScript running, so what comes
   *  back is what a crawler — or a visitor on a dead connection — would get. */
  test('the HTML arrives with the cats already in it', async ({ request }) => {
    const html = await (await request.get(subject.origin)).text();

    expect(html).toContain('thecatapi.com/images/');
    expect(html.match(/<img/g)?.length, 'the default is eight cats').toBe(8);
  });

  test('the page renders what the server fetched', async ({ page, capture }) => {
    await page.goto(subject.origin);

    await expect(page.getByRole('heading', { name: 'Cats, fetched on the server' })).toBeVisible();
    await expect(page.locator('img.cat-photo').first()).toBeVisible();
    await expect(page.getByText('8 cats came back')).toBeVisible();

    await capture('server-fetched-cats');
  });

  /** The trigger's input contract, end to end: a query param the page never wired up reaches the action, coerced
   *  to the type the step declared. */
  test('a query param reaches the action through the render trigger', async ({ request }) => {
    const html = await (await request.get(`${subject.origin}/?limit=3`)).text();

    expect(html.match(/<img/g)?.length).toBe(3);
  });

  test('the element is fed by the action, not by the browser', async ({ request }) => {
    const response = await request.get(`${subject.origin}/_rsc?location=%2F&ids=cats-provider`);
    const { serverData } = (await response.json()) as { serverData: Record<string, { records: unknown[] }> };

    expect(response.status()).toBe(200);
    expect(serverData['cats-provider'].records.length).toBeGreaterThan(0);
    // The output step named `records` and `count`; the fetch also returned `status` and `ok`.
    expect(Object.keys(serverData['cats-provider']).sort()).toEqual(['count', 'records']);
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
    await expect(page.locator('img.cat-photo')).toHaveCount(2);

    await page.getByRole('button', { name: 'Fetch new cats' }).click();

    // A skipped run is a RESULT: the flow carried on and the next step put the status on the page.
    await expect(page.getByText('The step reported: skipped')).toBeVisible();
    expect(attempts, 'a step called a server this page does not have').toEqual([]);

    await capture('no-server-tier');
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

describeTarget('blog', subject => {
  /** The one example that is a whole small product rather than a single wiring decision, so what is checked here
   *  is what its README promises a reader will be able to do: read the blog, open a post, publish one, be refused
   *  when the account may not — and see a header that knows who is looking. */

  const signIn = async (page: import('@playwright/test').Page, username: string) => {
    await page.goto(`${subject.origin}/login`);
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(
      page.getByRole('heading', { name: username, level: 3 }).or(page.getByText(`${username}@example.test`))
    ).toBeVisible();
  };

  test('the home page arrives with its posts already in it', async ({ request }) => {
    const html = await (await request.get(subject.origin)).text();

    // Rendered by the action while the page was built: no request from the browser, and nothing to load after it.
    expect(html).toContain('A page that arrives finished');
    expect(html).toContain('The button that does real work');
    // The covers are drawn, not fetched — an example shown in a room with bad wifi is not a page of broken images.
    expect(html).toContain('data:image/svg+xml');
  });

  test('the front page leads with a story and lists the rest', async ({ page, capture }) => {
    await page.goto(subject.origin);

    await expect(page.getByRole('heading', { name: 'A page that arrives finished', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Read the story' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The button that does real work' })).toBeVisible();
    // The sidebar is a second provider asking the same action a different question.
    await expect(page.getByRole('heading', { name: 'Topics' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'From the archive' })).toBeVisible();

    await capture('home');
  });

  test('the pager moves through the posts', async ({ page }) => {
    await page.goto(subject.origin);
    await expect(page.getByRole('heading', { name: 'The button that does real work' })).toBeVisible();

    // The pager lives inside the server-rendered list and is still clickable, because the browser takes that
    // section over once hydration is done. It writes the page into the URL; the server resolves the window.
    await page.getByRole('button', { name: '2', exact: true }).click();

    await expect(page).toHaveURL(/[?&]page=2/);
    await expect(page.getByRole('heading', { name: 'Six files' })).toBeVisible();

    // And back, which is the round trip that used to come back empty: the payload for a location is re-fetched.
    await page.getByRole('button', { name: '1', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'The button that does real work' })).toBeVisible();
  });

  test('a post opens at its own URL, with its body rendered', async ({ page, capture }) => {
    await page.goto(`${subject.origin}/post/a-page-that-arrives-finished`);

    await expect(page.getByRole('heading', { name: 'A page that arrives finished', level: 1 })).toBeVisible();
    // The markdown became real elements: a heading, a list, a quote.
    await expect(page.getByRole('heading', { name: 'What that changes' })).toBeVisible();
    await expect(page.getByText('That post does not exist.')).toBeHidden();
    // And the strip at the bottom, from the same flow that answered the post.
    await expect(page.getByText('Keep reading')).toBeVisible();

    await capture('post');
  });

  test('a URL nobody wrote a post for says so', async ({ page }) => {
    await page.goto(`${subject.origin}/post/no-such-post`);

    await expect(page.getByRole('heading', { name: 'That post does not exist.' })).toBeVisible();
    await expect(page.getByText('Keep reading')).toBeHidden();
  });

  /**
   * What a client-side navigation is allowed to PAINT.
   *
   * The sections of these pages are resolved on the server, so a route change has to fetch the new page's answer.
   * Until it arrives the page knows nothing — and an element whose binding has no value keeps whatever it was
   * authored with, which for a visibility binding means *visible*. That is how a signed-out visitor came to see
   * an editor link for a tenth of a second, and an account button with no name in it.
   *
   * Sampled per animation frame, so this is about what the browser actually put on screen: a state React passed
   * through between two commits was never seen by anybody and is not what is being guarded here.
   */
  test('a navigation paints no state the server contradicts', async ({ page }) => {
    // Each of these is a state that contradicts what the server answers for this visitor: an editor link nobody
    // signed in may use, an account button with no initial in it, a headline with no words, a strip of related
    // posts with nothing in it. `.prose` is the control — the body of the post, which must be painted.
    const WRITE_LINK = 'a[href="/write"].navLink';
    const EMPTY_PILL = '.accountPill .avatarSm:empty';
    const EMPTY_TITLE = '.articleTitle:empty';
    const EMPTY_STRIP = '.moreGrid:empty';
    const PROBES = [WRITE_LINK, EMPTY_PILL, EMPTY_TITLE, EMPTY_STRIP, '.prose'];

    await watchPaint(page, PROBES);
    await page.goto(subject.origin);
    await expect(page.getByRole('heading', { name: 'The button that does real work' })).toBeVisible();

    await resetPaint(page);
    await page.getByRole('heading', { name: 'The button that does real work' }).click();
    await expect(page.getByRole('heading', { name: 'What that changes' }).or(page.locator('.prose'))).toBeVisible();
    await page.waitForTimeout(400);

    /**
     * `.prose` is the control and is expected in both directions — on the way in it is the post that loaded, and
     * on the way out it is the post still on screen while the route changes. Everything else in the list is a
     * state the server contradicts, and none of it may reach a painted frame.
     */
    const offenders = async () =>
      (await paintTrace(page, PROBES))
        .filter(entry => entry.frames > 0 && entry.selector !== '.prose')
        .map(entry => `${entry.selector} (${entry.frames} frames)`);

    expect(await offenders(), 'the new page was painted before its own answer arrived').toEqual([]);
    expect((await paintTrace(page, ['.prose']))[0].frames, 'the post never rendered at all').toBeGreaterThan(0);

    /**
     * And the way back, which is the half a prefetch cannot cover: the URL has already changed by the time
     * anything hears about it. What holds there is the other half — a provider whose payload is for another page
     * knows it has not been answered yet, and renders nothing rather than its authored defaults.
     */
    await resetPaint(page);
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'The button that does real work' })).toBeVisible();

    expect(await offenders(), 'going back painted a state the server contradicts').toEqual([]);
  });

  /** Reading a post and going back to the list — all in the browser, with the sections resolved on the way. */
  test('a post and the way back are both client-side', async ({ page }) => {
    await page.goto(subject.origin);
    await page.getByRole('heading', { name: 'The button that does real work' }).click();

    await expect(page).toHaveURL(`${subject.origin}/post/the-button-that-does-real-work`);
    await expect(page.getByRole('heading', { name: 'The button that does real work', level: 1 })).toBeVisible();

    await page.getByRole('link', { name: 'Latest' }).click();

    await expect(page).toHaveURL(`${subject.origin}/`);
    await expect(page.getByRole('heading', { name: 'A page that arrives finished', level: 1 })).toBeVisible();
  });

  /**
   * The header is an element fed by the server, so it answers for the session rather than for everybody: no
   * editor link for a visitor who may not use it, and the account button carries a name once there is one.
   */
  test('the header knows who is looking', async ({ page }) => {
    await page.goto(subject.origin);

    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Write', exact: true })).toBeHidden();

    await signIn(page, 'ada');
    await page.goto(subject.origin);

    await expect(page.getByRole('link', { name: 'ada' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Write', exact: true })).toBeVisible();
  });

  /**
   * Light and dark, chosen rather than inherited.
   *
   * The space declares a value per scheme for every colour and the machine picks between them — until the toggle
   * in the header writes a class on the document root, which is what the palette's own rules are keyed on. What
   * is checked here is the whole chain: the class lands, the paint follows it, and the next visit remembers.
   */
  test('the theme toggle overrules the machine, and is remembered', async ({ page, capture }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(subject.origin);
    await expect(page.getByRole('heading', { name: 'A page that arrives finished', level: 1 })).toBeVisible();

    const root = page.locator('html');
    const background = () =>
      page
        .locator('.page')
        .first()
        .evaluate(node => getComputedStyle(node).backgroundColor);

    // Nothing on the root while nobody has chosen: the media queries are what answer, and they are guarded on
    // the absence of exactly this class.
    await expect(root).not.toHaveClass(/dark/);
    const light = await background();

    await page.locator('.themeToggle').click();

    await expect(root).toHaveClass(/dark/);
    expect(await background(), 'the class landed but nothing repainted').not.toBe(light);
    await capture('blog-dark');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'A page that arrives finished', level: 1 })).toBeVisible();

    await expect(root, 'the choice did not survive the reload').toHaveClass(/dark/);
  });

  /** Signed in and still not an author: the courtesy and the control are two different things. */
  test('a reader gets no editor link, and the editor still refuses her', async ({ page }) => {
    await signIn(page, 'grace');
    await page.goto(subject.origin);

    await expect(page.getByRole('link', { name: 'grace' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Write', exact: true })).toBeHidden();
  });

  test('one path answers with the sign-in or with the account, by session', async ({ page }) => {
    await signIn(page, 'ada');

    // Same URL, the other half of the pair: neither page contains a condition.
    await expect(page).toHaveURL(`${subject.origin}/login`);
    await expect(page.getByText('ada@example.test')).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('the editor is behind the sign-in, and sends whoever follows it there', async ({ page }) => {
    await page.goto(`${subject.origin}/write`);

    await expect(page).toHaveURL(`${subject.origin}/login`);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('ada writes a post and lands on it', async ({ page, capture }) => {
    await signIn(page, 'ada');

    await page.goto(`${subject.origin}/write`);
    await page.getByLabel('Title').fill('Written in a browser');
    await page.getByLabel('Standfirst').fill('A form, an action, and the page it produced.');
    await page.getByLabel('Body').fill('The **whole** trip: a form, an action, a page.');
    await capture('write');
    await page.getByRole('button', { name: 'Publish' }).click();

    // The flow read the action's answer and navigated to the URL it returned. Matched loosely on purpose: the
    // store is the running process, so a second run of this spec publishes a second post and gets `-2`.
    await expect(page).toHaveURL(/\/post\/written-in-a-browser/);
    await expect(page.getByRole('heading', { name: 'Written in a browser', level: 1 })).toBeVisible();
    await expect(page.getByText('ada', { exact: true }).first()).toBeVisible();
    await capture('published');
  });

  /** The point the example is built around: the account decides, the server decides with it, and the page only
   *  shows what came back. `grace` is signed in and gets as far as the button.
   *
   *  Its own block for one reason: the refusal IS the assertion, and a browser logs every 403 it is answered — so
   *  this is the one spec here that has read its console noise and allows it. */
  test.describe('refused', () => {
    test.use({ allowedConsoleErrors: [/403 \(Forbidden\)/] });

    test('grace reaches the editor by URL and is refused by the server', async ({ page, capture }) => {
      await signIn(page, 'grace');

      await page.goto(`${subject.origin}/write`);
      await page.getByLabel('Title').fill('Grace tries to publish');
      await page.getByLabel('Body').fill('This should not appear.');
      await page.getByRole('button', { name: 'Publish' }).click();

      await expect(page.getByText('The server refused this: forbidden')).toBeVisible();
      await expect(page).toHaveURL(`${subject.origin}/write`);
      await capture('refused');

      await page.goto(subject.origin);
      await expect(page.getByRole('heading', { name: 'Grace tries to publish' })).toHaveCount(0);
    });
  });
});
