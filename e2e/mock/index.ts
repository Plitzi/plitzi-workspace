import { answerGraphQL } from './graphql';

import type { Page } from '@playwright/test';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';

export * from './graphql';

/** Answers the builder's backend calls in the browser, for the runs that have no backend to call.
 *
 *  Registered AFTER the offline-network stub so it wins: Playwright matches routes in reverse registration
 *  order, and the general "nothing leaves this machine" rule would otherwise abort these before they are seen. */
export const mockBackend = async (page: Page, space: OfflineDataRaw): Promise<void> => {
  await page.route(
    url => url.pathname === '/' && /server\./.test(url.host),
    async route => {
      if (route.request().method() !== 'POST') {
        await route.fallback();

        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(answerGraphQL(route.request().postData(), space))
      });
    }
  );
};
