import { authorSpace, form, formControl, text } from '@plitzi/sdk-authoring';

import { describeTarget, expect, test } from '../../fixtures';

/**
 * The space's own tests (RFC 0031) in the builder: their view, a unit test written in its form and saved, and listed
 * back with how it stands. Against the mocked backend, which keeps what a save sends and passes every unit test — the
 * runner itself is held by the sdk's suite and the server's.
 */

const recordedSpace = () =>
  authorSpace({
    name: 'recorded-steps',
    permanentUrl: 'recorded-steps',
    pages: [
      {
        id: 'recorded-page',
        name: 'Home',
        slug: '',
        body: [
          text({ id: 'greeting', content: 'Welcome back' }),
          form({
            id: 'signup',
            children: [formControl({ id: 'email', name: 'email', label: 'Email', subType: 'email' })]
          })
        ]
      }
    ]
  });
describeTarget('builder', subject => {
  test('writes a unit test and lists it with how it stands', async ({ page, capture }) => {
    await page.goto(subject.origin, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Publish')).toBeVisible({ timeout: 60_000 });

    await page.getByTitle('Tests').click();
    await expect(page.getByText('No unit tests yet')).toBeVisible();
    await expect(page.getByText('No e2e tests yet')).toBeVisible();
    await capture('tests-empty');

    await page.getByRole('button', { name: 'Add unit test' }).click();
    await page.getByLabel('Title').fill('The page shows');
    await capture('unit-test-form');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.getByText('The page shows')).toBeVisible();
    await expect(page.getByText('Passes')).toBeVisible();
    await capture('unit-test-listed');
  });

  test('writes an e2e test, plays it on the draft and replays its run step by step', async ({ page, capture }) => {
    await page.goto(subject.origin, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Publish')).toBeVisible({ timeout: 60_000 });
    await page.getByTitle('Tests').click();

    await page.getByRole('button', { name: 'Add e2e test' }).click();
    await page.getByLabel('Title').fill('A visitor opens the card');
    await page.getByRole('button', { name: 'Add step' }).click();
    await page.getByRole('button', { name: 'Add expectation' }).click();
    await capture('e2e-test-form');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.getByText('A visitor opens the card')).toBeVisible();
    await page.getByRole('button', { name: 'Run e2e tests' }).click();
    await expect(page.getByText('Passes')).toBeVisible();
    await page.getByRole('button', { name: 'View run' }).click();

    await expect(page.getByRole('img', { name: /The page after step/ })).toBeVisible();
    await expect(page.getByText('expectShown')).toBeVisible();
    await capture('e2e-run-replayed');
  });

  test.describe('recording', () => {
    test.use({ mockSpace: recordedSpace() });

    test("records an e2e test's steps from what is done in the canvas, and hands them to its form", async ({
      page,
      capture
    }) => {
      await page.goto(subject.origin, { waitUntil: 'domcontentloaded' });
      const frame = page.frameLocator('iframe').first();
      await expect(frame.locator('[data-plitzi-el="greeting"]')).toBeAttached({ timeout: 60_000 });
      await page.getByTitle('Tests').click();

      await page.getByRole('button', { name: 'Add e2e test' }).click();
      await page.getByLabel('Title').fill('A visitor signs up');
      await page.getByRole('button', { name: 'Record steps' }).click();
      await expect(page.getByText('Recording “A visitor signs up”')).toBeVisible();

      const email = frame.locator('[data-plitzi-el="email"] input').first();
      await email.fill('ana@example.com');
      await email.blur();
      await expect(page.getByText(/1 step · last: type email/)).toBeVisible();

      await page.getByRole('button', { name: 'Click to expect' }).click();
      await frame.locator('[data-plitzi-el="greeting"]').click();
      await expect(page.getByText(/2 steps · last: expectText greeting/)).toBeVisible();
      await capture('e2e-recording');

      await page.getByRole('button', { name: 'Stop' }).click();
      await expect(page.getByLabel('Title')).toHaveValue('A visitor signs up');
      // The form's fields hold the steps recorded: what was typed, and the words the greeting must show.
      await expect
        .poll(() => page.locator('input').evaluateAll((fields: HTMLInputElement[]) => fields.map(field => field.value)))
        .toEqual(expect.arrayContaining(['ana@example.com', 'Welcome back']));
      await capture('e2e-recorded-form');
    });
  });
});
