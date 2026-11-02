import type { CheckReport } from './types';

/**
 * A page check of the server's own page while the space does not author: that one problem, said whole — never read as
 * a page of the space, its status a not-found page's and every element missing (it was, under an element drawn alone
 * whose name did not exist).
 */
export const notAuthoredReport = (pathname: string, width: number, said: string): CheckReport => ({
  path: pathname,
  width,
  ok: false,
  checked: 0,
  problems: [said],
  issues: [{ code: 'space-not-authored', message: said, width }],
  hiddenAtWidth: [],
  empty: [],
  outOfUse: [],
  consoleErrors: [],
  failedRequests: [],
  devTools: false,
  lists: {}
});
