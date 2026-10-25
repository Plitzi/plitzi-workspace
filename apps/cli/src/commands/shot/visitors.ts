import { openPage } from '@plitzi/sdk-authoring';

import { openProjectPage, PROJECT_QUIET_MS } from '../../browser';
import { checkAccount, signInAs } from '../check';

import type { Browser, BrowserPage, Scheme } from '../../browser';

/**
 * The other people of a play (`as <account> <step>`): each account signed in on a page of its own, beside the one
 * pictured or read — what another person does, seen where it lands. A run's designer could only show a live count
 * connected: the message that moves it is somebody else's.
 */
export interface Visitors {
  /** The account's page — opened at `at` and signed in the first time it is asked for, the same one after. */
  pageOf: (account: string, at: string) => Promise<BrowserPage | { problem: string }>;
  close: () => Promise<void>;
}

export interface VisitorsView {
  width: number;
  scheme?: Scheme;
  timezone?: string;
}

export const visitorsOn = (root: string, browser: Browser, origin: string, view: VisitorsView): Visitors => {
  const pages = new Map<string, BrowserPage>();

  return {
    pageOf: async (username, at) => {
      const open = pages.get(username);
      if (open) {
        return open;
      }

      const account = await checkAccount(root, username);
      if (account === undefined || 'problem' in account) {
        return { problem: account?.problem ?? `${username}: no account to sign in as` };
      }

      // A person taking part: announced on the page's channels, where the page pictured only watches them.
      const page = await openProjectPage(browser, origin, { height: 900, presence: true, ...view });
      const refused = await signInAs(page, origin, account);
      if (refused !== undefined) {
        await page.close();

        return { problem: `as ${username}: ${refused}` };
      }

      if ((await openPage(page, `${origin}${at}`, { quietMs: PROJECT_QUIET_MS })) === null) {
        await page.close();

        return { problem: `as ${username}: nothing answered at ${origin}${at}` };
      }

      await page.waitForSelector('[data-hydrated]', { timeout: 10_000 }).catch(() => undefined);
      pages.set(username, page);

      return page;
    },
    close: async () => {
      await Promise.all([...pages.values()].map(page => page.close()));
      pages.clear();
    }
  };
};
