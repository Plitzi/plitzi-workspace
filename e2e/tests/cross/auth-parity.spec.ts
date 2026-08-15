import { expect, test } from '../../fixtures';
import { openHarness, renderSpace } from '../../helpers/harness';
import { authSpace } from '../../spaces/auth';
import { target } from '../../targets';

/** Who may see which page is decided by code the client router and the server share. So the same space, with
 *  nobody signed in, has to reach the same conclusion in a browser with no backend at all as it does on a server
 *  that checked a cookie — and this is the only place that comparison happens.
 *
 *  It is also the check that catches the worst version of getting it wrong: a member-only page rendering to a
 *  visitor because the path that decides was only ever exercised with a session in hand. */
test.describe('access levels, with and without a server', () => {
  test('a space with no session renders the guest page in the browser alone', async ({ page, capture }) => {
    await openHarness(page);
    await renderSpace(page, authSpace());

    await expect(page.getByRole('heading', { name: 'Welcome, guest' })).toBeVisible();
    await expect(page.getByText('You are not signed in.')).toBeVisible();

    // The member page is in the schema this render was handed. Not being on screen is the router's decision, not
    // an absence of data.
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeHidden();
    await expect(page.getByText('Your account')).toBeHidden();

    await capture('guest-client-side');
  });

  test('and the server, asked by a visitor, agrees', async ({ page, capture }) => {
    await page.goto(target('auth-server').origin);

    await expect(page.getByRole('heading', { name: 'Welcome, guest' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeHidden();

    await capture('guest-server-side');
  });

  /** The strongest form of it: the member-only markup must not be in the response at all. Hidden in the DOM would
   *  still mean it was sent to somebody who may not have it. */
  test('the server sends a visitor no member-only markup', async ({ request }) => {
    const html = await (await request.get(target('auth-server').origin)).text();
    const body = html.slice(html.indexOf('<body'));
    const rendered = body.slice(0, body.indexOf('<script'));

    expect(rendered, 'a guest was served the member page').not.toContain('Sign out');
  });
});
