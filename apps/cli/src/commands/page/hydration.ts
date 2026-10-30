import { awaitHydration as spaceHydrated } from '@plitzi/sdk-authoring';

import type { BrowserPage } from '../../browser';

/**
 * Waits for the space on the page to hydrate — sdk-authoring's wait, the one an e2e test's runner holds too — and says
 * what a project does about one that never does: a dev server compiles a page on its first request.
 */
export const awaitHydration = async (page: BrowserPage): Promise<string | undefined> => {
  const late = await spaceHydrated(page);

  return late === undefined
    ? undefined
    : `${late}, and what is read is the server's HTML. A dev server compiling the page on its first request is the usual cause: run it again — still not hydrated, plitzi page check says what stops it`;
};
