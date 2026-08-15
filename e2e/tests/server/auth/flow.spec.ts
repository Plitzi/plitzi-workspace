import { describeTarget, expect, test } from '../../../fixtures';
import { CREDENTIALS } from '../../../server/accounts';

/** A visitor becoming a member and back again, walked the way a person walks it.
 *
 *  Every step here is one that only holds end to end. Whether a guest may see a page is decided by the router
 *  from the session; whether the right name is on screen is decided by a binding resolving against the identity
 *  the server attached to the render; whether signing out actually signs you out is decided by a row in the
 *  account store no longer matching a token. None of those can be answered without a browser, a server, and a
 *  cookie travelling between them.
 *
 *  Run serially: the account store keeps ONE session per account, exactly as a real one does, so two tests signing
 *  in as the same person in parallel would each quietly retire the other's session. */
test.describe.configure({ mode: 'serial' });

const { editor, viewer } = CREDENTIALS;

describeTarget('auth-server', subject => {
  const signIn = async (page: import('@playwright/test').Page, who: { username: string; password: string }) => {
    await page.getByLabel('Username').fill(who.username);
    await page.getByLabel('Password').fill(who.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
  };

  /** Written as named steps, so the journey can be WATCHED rather than only asserted: each one is its own entry in
   *  Playwright's UI timeline and its own numbered PNG under `.artifacts/screenshots/`. A page that passes every
   *  assertion and still looks wrong is caught by looking, and nowhere else. */
  test('the whole journey: guest, sign in, member pages, bindings, sign out', async ({ page, step }) => {
    await step('guest home', async () => {
      // Both pages live at `/` and the router picks by session — nothing conditional is written into either one.
      await page.goto(subject.origin);

      await expect(page.getByRole('heading', { name: 'Welcome, guest' })).toBeVisible();
      await expect(page.getByText('You are not signed in.')).toBeVisible();
    });

    await step('member page turns a guest away', async () => {
      await page.goto(`${subject.origin}/account`);

      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    });

    await step('sign in', async () => {
      // The page they are standing on is guests-only, so the session itself is what moves them off it.
      await signIn(page, editor);

      await expect(page).toHaveURL(new RegExp(`^${subject.origin}/?$`));
    });

    await step('member home, heading bound to the session', async () => {
      await expect(page.getByRole('heading', { name: editor.username })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Welcome, guest' })).toBeHidden();
    });

    await step('account page, reached by a link', async () => {
      await page.getByText('Your account').click();

      await expect(page).toHaveURL(/\/account$/);
      await expect(page.getByRole('heading', { name: 'Your account' })).toBeVisible();
      // Two more bindings, onto two different fields of the same identity.
      await expect(page.getByText(editor.username, { exact: true })).toBeVisible();
      await expect(page.getByText(editor.email)).toBeVisible();
    });

    await step('sign out', async () => {
      // Members-only page: losing the session moves them off it the same way gaining one did — by the page's own
      // redirect rule, not by anything the button knows.
      await page.getByRole('button', { name: 'Sign out' }).click();

      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByText(editor.email)).toBeHidden();
    });

    await step('everything is somebody else’s again', async () => {
      await page.goto(subject.origin);
      await expect(page.getByRole('heading', { name: 'Welcome, guest' })).toBeVisible();

      await page.goto(`${subject.origin}/account`);
      await expect(page, 'the protected page was still reachable after signing out').toHaveURL(/\/login$/);
    });
  });

  /** The bindings have to be resolved by the time the HTML leaves the server. Painted in afterwards they would
   *  still look right in a screenshot, and the page would ship a blank name to anything that does not run
   *  JavaScript — a crawler, a preview card, a reader on a slow connection. */
  test('the account page arrives with the identity already in it', async ({ page }) => {
    await page.goto(`${subject.origin}/login`);
    await signIn(page, editor);
    await expect(page.getByRole('heading', { name: editor.username })).toBeVisible();

    // Same context, so this request carries the session cookie the browser just received.
    const html = await (await page.request.get(`${subject.origin}/account`)).text();
    const body = html.slice(html.indexOf('<body'));

    expect(body, 'the email was not in the server-rendered markup').toContain(editor.email);
  });

  test('a second account sees its own identity, not the first one cached', async ({ page }) => {
    await page.goto(`${subject.origin}/login`);
    await signIn(page, viewer);

    await expect(page.getByRole('heading', { name: viewer.username })).toBeVisible();

    await page.goto(`${subject.origin}/account`);

    await expect(page.getByText(viewer.email)).toBeVisible();
    await expect(page.getByText(editor.email)).toBeHidden();
  });

  test.describe('a refused sign-in', () => {
    // The browser logs every failed request, and this test's whole point is to cause one. Allowed by pattern
    // rather than by switching the guard off, so anything else the page reports still fails the test.
    test.use({ allowedConsoleErrors: [/401 \(Unauthorized\)/] });

    test('leaves you a guest', async ({ page }) => {
      await page.goto(`${subject.origin}/login`);
      await signIn(page, { username: editor.username, password: 'not-the-password' });

      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

      await page.goto(subject.origin);

      await expect(page.getByRole('heading', { name: 'Welcome, guest' })).toBeVisible();
    });
  });

  /** The redirect has to happen on the SERVER too. A guard that only runs in the browser is a guard that ships the
   *  protected page to anything that reads the response before running scripts. */
  test('the server itself turns a guest away from the member page', async ({ request }) => {
    const response = await request.get(`${subject.origin}/account`, { maxRedirects: 0 });

    expect(response.status()).toBe(302);
    expect(response.headers().location).toBe('/login');
  });
});
