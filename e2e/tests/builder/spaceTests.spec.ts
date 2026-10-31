import { authorSpace, button, e2e, form, formControl, onClick, setState, text } from '@plitzi/sdk-authoring';

import { describeTarget, expect, test } from '../../fixtures';

import type { Page } from '@playwright/test';

/**
 * The space's own tests in the builder: their view; an element check written in its form; a flow written in
 * the studio by using the page beside it and played there; and every flow played in turn on the page, with a log.
 * Against the mocked backend, which keeps what a save sends — the runner on the server is held by the server's suite.
 */

const greetingSpace = () =>
  authorSpace({
    name: 'greeting-flows',
    permanentUrl: 'greeting-flows',
    tests: {
      e2e: [
        e2e.test({
          id: 'says-thanks',
          title: 'A visitor says hello and is thanked',
          page: '/',
          steps: [
            e2e.expectHidden('thanks'),
            e2e.click('hello'),
            e2e.expectText('thanks', 'Thanks for saying hello'),
            // Read from the canvas' own window: the studio puts the page's state bridge there.
            e2e.expectState('greeted', true)
          ]
        }),
        e2e.test({
          id: 'types-a-name',
          title: 'A visitor types their name on a phone',
          page: '/',
          width: 390,
          steps: [e2e.type('name', 'Ana'), e2e.expectShown('hello')]
        }),
        e2e.test({
          id: 'wrong-words',
          title: 'Expects words the page never shows',
          page: '/',
          steps: [e2e.expectText('greeting', 'Goodbye')]
        })
      ]
    },
    pages: [
      {
        id: 'greeting-page',
        name: 'Home',
        slug: '',
        body: [
          text({ id: 'greeting', content: 'Welcome back' }),
          button({
            id: 'hello',
            content: 'Say hello',
            flows: [[onClick(), setState({ key: 'greeted', type: 'boolean', value: true })]]
          }),
          text({ id: 'thanks', content: 'Thanks for saying hello', visible: 'state.greeted' }),
          form({ id: 'signup', children: [formControl({ id: 'name', name: 'name', label: 'Name' })] })
        ]
      }
    ]
  });

const canvas = (page: Page) => page.frameLocator('iframe').first();

const openTests = async (page: Page, origin: string): Promise<void> => {
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Publish')).toBeVisible({ timeout: 60_000 });
  await page.getByTitle('Tests').click();
};

describeTarget('builder', subject => {
  test('writes an element check and lists it with how it stands', async ({ page, capture }) => {
    await openTests(page, subject.origin);
    await expect(page.getByText(/^No journeys yet/)).toBeVisible();
    await page.getByRole('tab', { name: 'Element checks' }).click();
    await expect(page.getByText('No element checks yet')).toBeVisible();
    await capture('tests-empty');

    await page.getByRole('button', { name: 'Add an element check' }).click();
    await page.getByLabel('Title').fill('The page shows');
    await capture('unit-test-form');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.getByText('The page shows')).toBeVisible();
    await expect(page.getByText('Passes')).toBeVisible();
    await capture('unit-test-listed');
  });

  test.describe('flows', () => {
    test.use({ mockSpace: greetingSpace() });

    test('writes a flow by using the page beside it, plays it there and saves it', async ({ page, capture }) => {
      await openTests(page, subject.origin);
      await expect(canvas(page).locator('[data-plitzi-el="hello"]')).toBeVisible({ timeout: 30_000 });
      await page.getByRole('button', { name: 'New journey' }).click();

      const panel = page.getByRole('region', { name: 'The journey chosen' });
      await panel.getByLabel('What it checks').fill('A visitor is thanked');
      await panel.getByRole('button', { name: 'Record' }).click();
      await expect(canvas(page).locator('[data-plitzi-el="hello"]')).toBeVisible({ timeout: 30_000 });
      await canvas(page).locator('[data-plitzi-el="hello"]').click();
      await expect(panel.getByText('Click', { exact: true })).toBeVisible();
      await panel.getByRole('button', { name: 'Add a check' }).click();
      await canvas(page).locator('[data-plitzi-el="thanks"]').click();
      await expect(panel.getByText('“Thanks for saying hello”')).toBeVisible();
      await panel.getByRole('button', { name: 'Stop recording' }).click();
      await capture('flow-recorded');

      await panel.getByRole('button', { name: 'Play', exact: true }).click();
      await expect(panel.getByRole('status')).toContainText('Passed: 2 steps', { timeout: 30_000 });
      await capture('flow-passed');

      await panel.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(panel.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
      await expect(page.getByRole('region', { name: 'Journeys' }).getByText('A visitor is thanked')).toBeVisible();
    });

    test('plays a flow up to the step pressed, and holds the page there', async ({ page, capture }) => {
      await openTests(page, subject.origin);
      const panel = page.getByRole('region', { name: 'The journey chosen' });
      await expect(panel.getByLabel('What it checks')).toHaveValue('A visitor says hello and is thanked');

      // The second step — the click — pressed: the flow plays to it, and the page holds as it leaves it.
      await panel.getByRole('listitem').nth(1).hover();
      await panel.getByTitle('Play up to this step, and hold there').nth(1).click();
      await expect(panel.getByText(/^Held here/)).toBeVisible({ timeout: 30_000 });
      await expect(canvas(page).locator('[data-plitzi-el="thanks"]')).toBeVisible();
      await capture('flow-held');

      await panel.getByRole('button', { name: 'Continue' }).click();
      await expect(panel.getByRole('status')).toContainText('Passed: 4 steps', { timeout: 30_000 });
    });

    test('opens the flow last chosen again after a reload, and plays at the pause asked for', async ({ page }) => {
      await openTests(page, subject.origin);
      const flows = page.getByRole('region', { name: 'Journeys' });
      const panel = page.getByRole('region', { name: 'The journey chosen' });
      await flows.getByText('A visitor types their name on a phone').click();
      await expect(panel.getByLabel('What it checks')).toHaveValue('A visitor types their name on a phone');

      // 0 is the least: each step played at once — and kept, as the journey chosen is, through a reload.
      await page.getByLabel('Pause between steps, in seconds').fill('0');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(panel.getByLabel('What it checks')).toHaveValue('A visitor types their name on a phone', {
        timeout: 60_000
      });
      await expect(page.getByLabel('Pause between steps, in seconds')).toHaveValue('0');
      await page.getByLabel('Pause between steps, in seconds').fill('-2');
      await expect(page.getByLabel('Pause between steps, in seconds')).toHaveValue('0');
    });

    test('plays every flow on the page in turn, each with how it went, and logs its steps', async ({
      page,
      capture
    }) => {
      await openTests(page, subject.origin);
      await page.getByRole('button', { name: 'Play all' }).click();

      const flows = page.getByRole('region', { name: 'Journeys' });
      await expect(flows.getByText('Live')).toBeVisible();
      await capture('play-all-live');
      const panel = page.getByRole('region', { name: 'The journey chosen' });
      await expect(panel.getByText('1 of 3 journeys fail.')).toBeVisible({ timeout: 60_000 });
      await expect(flows.getByText('Passes', { exact: true })).toHaveCount(2);
      await expect(flows.getByText('Fails', { exact: true })).toHaveCount(1);
      await expect(panel.getByText(/it reads "Welcome back/).first()).toBeVisible();
      await expect(panel.getByText(/Type “Ana” into/)).toBeVisible();
      await capture('play-all');
    });

    test('says what is wrong with a step on the step itself, as it is written', async ({ page }) => {
      await openTests(page, subject.origin);
      await page.getByRole('button', { name: 'New journey' }).click();
      const panel = page.getByRole('region', { name: 'The journey chosen' });
      await panel.getByRole('combobox', { name: 'Add a step by hand' }).selectOption('expectPosition');
      await panel.getByRole('button', { name: 'Done' }).click();

      // Read as it is written, before it is saved: the step says it is no relation, on itself.
      await expect(panel.getByText(/is no relation/)).toBeVisible();
      await expect(page.getByRole('tab', { name: /Journeys/ }).getByRole('img', { name: /to look at/ })).toBeVisible();
    });

    test('stops every flow played in turn when asked, and says where they stand', async ({ page }) => {
      await openTests(page, subject.origin);
      await page.getByRole('button', { name: 'Play all' }).click();

      const flows = page.getByRole('region', { name: 'Journeys' });
      await expect(flows.getByText('Live')).toBeVisible();
      await page.getByRole('button', { name: 'Stop' }).first().click();

      const panel = page.getByRole('region', { name: 'The journey chosen' });
      await expect(panel.getByText('Stopped.', { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(flows.getByText('Stopped', { exact: true }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Play all' })).toBeEnabled();
    });

    test('offers no new journey once the plan keeps no more, and names the plan that keeps more', async ({ page }) => {
      // A plan that keeps the three journeys the space has: answered for this page, before the builder asks.
      await page.route(
        url => /^api\./.test(url.host) && /^\/spaces\/[^/]+\/entitlements$/.test(url.pathname),
        async route => {
          const headers = {
            'access-control-allow-origin': (await route.request().headerValue('origin')) ?? '*',
            'access-control-allow-credentials': 'true',
            'access-control-allow-headers': 'plitzi-access-token, content-type'
          };
          const entitlements = {
            tierLabel: 'Free',
            snapshotsKept: 0,
            analyticsDays: 7,
            journeysPerSpace: 3,
            serverRunsPerMonth: 10,
            moreJourneys: { requires: 'Site', allows: 10, upgradeUrl: 'https://plitzi.test/pricing?plan=site' },
            capabilities: {}
          };
          await route.fulfill(
            route.request().method() === 'OPTIONS'
              ? { status: 204, headers }
              : { status: 200, contentType: 'application/json', headers, body: JSON.stringify({ entitlements }) }
          );
        }
      );
      await openTests(page, subject.origin);

      const flows = page.getByRole('region', { name: 'Journeys' });
      // Three or more, as the tests before it in this worker left the mocked space: at the plan's number either way.
      await expect(flows.getByText(/^Journeys · \d+ of 3$/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'New journey' })).toBeDisabled();
      await expect(flows.getByRole('status')).toContainText('The Free plan keeps 3 journeys per space');
      await expect(flows.getByRole('link', { name: 'See the plans' })).toHaveAttribute(
        'href',
        'https://plitzi.test/pricing?plan=site'
      );

      // What the plan allows, and what is used of it: the journeys kept, the month's plays and when they come back.
      const plan = page.getByRole('region', { name: 'What the plan allows' });
      await expect(plan).toContainText('Free plan');
      await expect(plan).toContainText(/Journeys kept\s*\d+ of 3/);
      await expect(plan).toContainText('2 of 10');
      await expect(plan).toContainText('8 left · they start again on 1 Nov');
    });

    test('plays the flows on the server and replays a run step by step', async ({ page, capture }) => {
      await openTests(page, subject.origin);
      await page.getByRole('button', { name: 'Run on the server' }).click();
      await page.getByTitle('Passed on the server: view the run').first().click();

      await expect(page.getByRole('img', { name: /The page after step/ })).toBeVisible();
      await capture('e2e-run-replayed');
    });
  });
});
