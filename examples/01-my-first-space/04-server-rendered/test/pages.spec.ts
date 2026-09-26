import { expect, test } from '@playwright/test';

import { offlineData } from '@plitzi/example-space/space';
import { inspectPage, locate } from '@plitzi/sdk-authoring';

/** The space this server renders, as authored: every element by the name it was given. */
const { handles } = offlineData();

/** This server registers no component for the sample's three RSC elements, so they and their section are not owed. */
const WITHOUT_RSC = ['rsc-server', 'rsc-client', 'rsc-shared', 'rsc-section'];

test('the home page renders whole', async ({ page }) => {
  await page.goto('/');

  expect((await inspectPage(page, handles, { elements: 'all', ignore: WITHOUT_RSC })).problems).toEqual([]);
});

test('the heading is the one the space declares', async ({ page }) => {
  await page.goto('/');

  await expect(locate(page, handles)('mainHeading')).toHaveText('Welcome To Plitzi');
});
