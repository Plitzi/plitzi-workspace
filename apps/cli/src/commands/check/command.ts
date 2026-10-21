import { launchBrowser, projectOrigin } from '../../browser';
import { projectHere } from '../existingProject';
import { fail } from '../terminal';
import { checkAccount } from './account';
import { keptToTask } from './apart';
import { checkAt } from './inspect';
import { moduleSpace, projectSpace } from './space';
import { reportText } from './text';
import { serverErrors } from './types';

import type { Scheme } from '../../browser';
import type { ExistingProject } from '../existingProject';
import type { Account } from './account';
import type { CheckAsk, CheckOptions, CheckReport, ClickAsk, Expectation } from './types';

/**
 * `plitzi page check`: every path at every width, in one browser — and the routes of a whole-project check.
 */

export const check = async (routes: string[], options: CheckOptions): Promise<void> => {
  const project = await projectHere('whose page to check');
  if (!project) {
    return;
  }

  // Signed in only when asked: a page checked as nobody is what a visitor who has not signed in sees.
  const account = options.as === undefined ? undefined : await checkAccount(project.root, options.as);
  if (account && 'problem' in account) {
    fail(`--as ${account.problem}.`);

    return;
  }

  // A path is a page's address: one that reads as a flag is a flag cut off from its command (`npx … check -- /x --width`).
  const flags = routes.filter(route => route.startsWith('-'));
  if (flags.length > 0) {
    fail(
      `${flags.join(', ')} ${flags.length === 1 ? 'is' : 'are'} not a page's path: options after \`--\` are read as paths. Leave the \`--\` out (\`npx plitzi page check /x --width 1440,390\`); it belongs only after \`npm run check\`.`
    );

    return;
  }

  if (options.click && routes.length > 1) {
    fail(`--click clicks one element of one page: ${String(routes.length)} were named.`);

    return;
  }

  const asked: CheckAsk = { state: Boolean(options.state), elements: options.element ?? [] };
  const reports = await checkRoutes(project, routes.length > 0 ? routes : ['/'], {
    widths: options.width ?? [1440, 390],
    asked,
    ssr: Boolean(options.ssr),
    ...(options.scheme ? { scheme: options.scheme } : {}),
    presence: options.presence === true,
    ...(account ? { account } : {}),
    ...(options.click || options.fill
      ? { click: { ...(options.click ? { element: options.click } : {}), fill: options.fill ?? [] } }
      : {}),
    ...(options.expect ? { expect: options.expect } : {}),
    ...(options.then ? { then: options.then } : {}),
    ...(options.url ? { url: options.url } : {}),
    ...(options.space ? { space: options.space } : {})
  });
  if ('problem' in reports) {
    fail(reports.problem);

    return;
  }

  const kept = await keptToTask(project.root, reports);
  console.log(options.json ? JSON.stringify(kept) : kept.map(report => reportText(report, asked)).join('\n'));
  if (kept.some(report => !report.ok)) {
    process.exitCode = 1;
  }
};

/**
 * Pages of the running project checked, each at each width, in one browser: what `check` does for one route and
 * `verify` for every page that has no parameter in its path. A project the server does not answer for, or with no
 * browser, is a problem said once rather than a report per page.
 */
export const checkRoutes = async (
  project: { root: string; plitzi?: ExistingProject['plitzi'] },
  routes: readonly string[],
  options: {
    widths: readonly number[];
    asked: CheckAsk;
    ssr: boolean;
    scheme?: Scheme;
    /** Taking part in the page's channels, as a visitor does — otherwise it only watches them. */
    presence?: boolean;
    account?: Account;
    click?: ClickAsk;
    expect?: Expectation[];
    then?: string[];
    /** Where the project is served, when not by `npm start` here (`--url`). */
    url?: string;
    /** A space module to check the pages against instead of the project's (`--space`). */
    space?: string;
  }
): Promise<CheckReport[] | { problem: string }> => {
  const plitzi = project.plitzi?.kind === 'project' ? project.plitzi : undefined;
  const where = await projectOrigin(project.root, plitzi, options.url);
  if ('problem' in where) {
    return where;
  }

  const authored = options.space
    ? await moduleSpace(options.space)
    : plitzi?.source === 'local'
      ? await projectSpace(project.root)
      : undefined;
  if (authored && 'problem' in authored) {
    return authored;
  }

  const browser = await launchBrowser(project.root);
  if ('problem' in browser) {
    return browser;
  }

  try {
    const reports: CheckReport[] = [];
    for (const route of routes) {
      for (const width of options.widths) {
        const look = () =>
          checkAt(
            browser,
            where.origin,
            route,
            width,
            { ...(options.scheme ? { scheme: options.scheme } : {}), presence: options.presence === true },
            authored,
            options.asked,
            options.ssr,
            options.account,
            options.click,
            options.expect,
            options.then
          );
        const first = await look();
        const failed = first.flatMap(serverErrors);
        // Once, and said: a page red for a second of somebody else's outage is not one red for anything of its own.
        const looked = failed.length > 0 ? (await look()).map(each => ({ ...each, retriedAfter: failed })) : first;
        reports.push(...looked.map(each => ({ ...each, ...(options.scheme ? { scheme: options.scheme } : {}) })));
      }
    }

    return reports;
  } finally {
    await browser.close();
  }
};
