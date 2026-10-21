import { pictureOf } from './capture';

import type { Taken, View } from './types';
import type { Browser } from '../../browser';

/** How long to wait before each try again of a page its site turned away as busy. */
const RETRY_AFTER_MS = [10_000, 30_000];

/** The status the page's own document came with: what tells a page from an error a site answered in its place. */
const documentStatus = (): number => {
  const navigation = performance.getEntriesByType('navigation').at(0);
  const status: unknown = navigation ? Reflect.get(navigation, 'responseStatus') : undefined;

  return typeof status === 'number' ? status : 0;
};

/**
 * A page of the reference pictured once its site answers it — never its error page kept as the page: la-velada's
 * original answered its fighters' list with "You are being rate limited". A site that says it is busy (429, 503) is
 * asked again, later; any other error is said.
 */
export const pictureAnswered = async (
  browser: Browser,
  url: string,
  view: View
): Promise<(Taken & { notFound?: true }) | { problem: string }> => {
  for (let attempt = 0; ; attempt += 1) {
    // A picture the browser gave up on (a font that never loaded, a page still busy) is this page's failure, asked
    // once more — never the end of every page after it: la-velada's original timed one out, and the command crashed.
    const taken = await pictureOf(browser, url, view).catch(
      (error: unknown) =>
        ({
          problem: `the picture was not taken: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`
        }) as const
    );
    if ('problem' in taken) {
      if (attempt === 0 && taken.problem.startsWith('the picture was not taken')) {
        continue;
      }

      return taken;
    }

    const status = await taken.page.evaluate(documentStatus, undefined);
    if (status < 400) {
      return taken;
    }

    // An address nothing answers is a page of its own — the site's 404, which a copy makes too (la-velada's "Elige a
    // tu boxeador"): kept, and said so, never refused as an error page.
    if (status === 404) {
      return { ...taken, notFound: true };
    }

    await taken.page.close();
    const wait = RETRY_AFTER_MS.at(attempt);
    if ((status !== 429 && status !== 503) || wait === undefined) {
      return {
        problem: `the site answered ${String(status)}${status === 429 ? ' (asked too often) — keep it again later' : ''}`
      };
    }

    await new Promise(resolve => setTimeout(resolve, wait));
  }
};
