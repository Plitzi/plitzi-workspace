import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';
import { projectMark } from '@plitzi/sdk-shared/project';

import { themeIssues } from './themes';
import { launchBrowser } from '../../browser';
import { originHere } from '../../runs/copyServer';
import { inTurns } from '../../runs/inTurns';
import { runPaths, runsDir, taskPaths } from '../../runs/paths';
import { previewDir } from '../../runs/preview';
import { projectHere } from '../existingProject';
import { fail, unanswered, UNANSWERED_EXIT } from '../terminal';
import { keptToReference, keptToTask } from './apart';
import { checkAt } from './inspect';
import { moduleSpace, projectSpace } from './space';
import { actingSteps } from '../shot/steps';
import { visitorAsked, visitViewOf } from '../visit';
import { reportText } from './text';
import { serverErrors } from './types';

import type { ExistingProject } from '../existingProject';
import type { CheckAsk, CheckOptions, CheckReport, ClickAsk, Expectation } from './types';
import type { Visitor, VisitView } from '../visit';

/**
 * `plitzi page check`: every path at every width, in one browser — and the routes of a whole-project check.
 */

export const check = async (routes: string[], options: CheckOptions): Promise<void> => {
  const project = await projectHere('whose page to check');
  if (!project) {
    return;
  }

  const visitor = await visitorAsked(project.root, options);
  if (visitor === null) {
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

  if (options.click && options.hover) {
    fail('One interaction a check: --click an element, or --hover one — two checks for both.');

    return;
  }

  if ((options.click || options.hover) && routes.length > 1) {
    fail(
      `--${options.click ? 'click clicks' : 'hover points at'} one element of one page: ${String(routes.length)} were named.`
    );

    return;
  }

  const steps = actingSteps(options.steps, 'page check', { others: false });
  if ('problem' in steps) {
    fail(`${steps.problem}.`);

    return;
  }

  const asked: CheckAsk = {
    state: Boolean(options.state),
    ...(typeof options.state === 'string'
      ? {
          stateOf: options.state
            .split(',')
            .map(name => name.trim())
            .filter(Boolean)
        }
      : {}),
    elements: options.element ?? [],
    ...(options.status === undefined ? {} : { status: options.status }),
    ...(options.redirectsTo === undefined ? {} : { redirectsTo: options.redirectsTo }),
    ...(steps.length > 0 ? { steps } : {})
  };
  const reports = await checkRoutes(project, routes.length > 0 ? routes : ['/'], {
    widths: options.width ?? [1440, 390],
    asked,
    ssr: Boolean(options.ssr),
    ...(options.scheme ? { scheme: options.scheme } : {}),
    ...visitViewOf(options),
    ...visitor,
    ...(options.click || options.hover || options.fill
      ? {
          click: {
            ...(options.click ? { element: options.click } : {}),
            ...(options.hover ? { element: options.hover, hover: true } : {}),
            fill: options.fill ?? []
          }
        }
      : {}),
    ...(options.expect ? { expect: options.expect } : {}),
    ...(options.then ? { then: options.then } : {}),
    ...(options.url ? { url: options.url } : {}),
    ...(options.space ? { space: options.space } : {}),
    ...(options.themes ? { themes: true } : {}),
    ...(options.standIns ? { standIns: true } : {})
  });
  if ('problem' in reports) {
    unanswered(reports.problem);

    return;
  }

  const kept = await keptToReference(project.root, await keptToTask(project.root, reports));
  console.log(options.json ? JSON.stringify(kept) : kept.map(report => reportText(report, asked)).join('\n'));
  const failed = kept.filter(report => !report.ok);
  // Nothing answered where the page was asked: no page was read, so none is said wrong.
  if (
    failed.length > 0 &&
    failed.every(report => report.issues.length > 0 && report.issues.every(issue => issue.code === 'no-answer'))
  ) {
    process.exitCode = UNANSWERED_EXIT;
  } else if (failed.length > 0) {
    process.exitCode = 1;
  }
};

/**
 * Pages of the running project checked, each at each width, in one browser: what `check` does for one route and
 * `verify` for every page that has no parameter in its path. A project the server does not answer for, or with no
 * browser, is a problem said once rather than a report per page.
 */
/**
 * The folder a server named by `--url` serves, when it is one of this project's run copies or a run's preview: its `/health` says the mark
 * of the folder it serves, and the copy with that mark is the space its routes are judged by — not the project's own
 * (a real product page on a copy's server read as "the page for an address nothing answers", judged by the
 * tour still in the project). None found: the project's.
 */
const servedFolder = async (root: string, url: string): Promise<string | undefined> => {
  const health: unknown = await fetch(new URL('/health', url), { signal: AbortSignal.timeout(2_000) })
    .then(async (answer): Promise<unknown> => answer.json())
    .catch(() => undefined);
  const mark = isRecord(health) && typeof health.Instance === 'string' ? health.Instance : undefined;
  if (mark === undefined || mark === projectMark(root)) {
    return undefined;
  }

  for (const run of await fs.readdir(runsDir(root)).catch(() => [])) {
    // The run's preview too (`run preview`, its approved work): a run's lead read /rooms and /charts there as not
    // found, judged by the project's space the finish had not written yet.
    const preview = previewDir(runPaths(root, run));
    if (projectMark(preview) === mark) {
      return preview;
    }

    for (const task of await fs.readdir(path.join(runsDir(root), run, 'tasks')).catch(() => [])) {
      const work = taskPaths(runPaths(root, run), task).work;
      if (projectMark(work) === mark) {
        return work;
      }
    }
  }

  return undefined;
};

/**
 * How many pages a check reads at once, each with its widths and schemes at once: four of a run's pages at two
 * widths took 6.9 s one by one, 4.2 s two at a time — and no less three or four at a time, the project's server busy.
 */
const ROUTES_AT_ONCE = 2;

export const checkRoutes = async (
  project: { root: string; plitzi?: ExistingProject['plitzi'] },
  routes: readonly string[],
  options: {
    widths: readonly number[];
    asked: CheckAsk;
    ssr: boolean;
    click?: ClickAsk;
    expect?: Expectation[];
    then?: string[];
    /** Where the project is served, when not by `npm start` here (`--url`). */
    url?: string;
    /** A space module to check the pages against instead of the project's (`--space`). */
    space?: string;
    /** Each page read in light and in dark too: a ground that does not follow the theme under a text that does. */
    themes?: boolean;
  } & Pick<VisitView, 'scheme' | 'presence' | 'timezone' | 'conditions' | 'standIns'> &
    Visitor
): Promise<CheckReport[] | { problem: string }> => {
  const plitzi = project.plitzi?.kind === 'project' ? project.plitzi : undefined;
  const where = await originHere(project.root, plitzi, options.url);
  if ('problem' in where) {
    return where;
  }

  try {
    // The space authored while the browser starts: neither waits on the other (0.5 s and 0.3 s, one after the other).
    const [authored, browser] = await Promise.all([
      options.space
        ? moduleSpace(options.space)
        : plitzi?.source === 'local'
          ? projectSpace(options.url ? ((await servedFolder(project.root, options.url)) ?? project.root) : project.root)
          : Promise.resolve(undefined),
      launchBrowser(project.root)
    ]);
    if (authored && 'problem' in authored) {
      if (!('problem' in browser)) {
        await browser.close();
      }

      return authored;
    }

    if ('problem' in browser) {
      return browser;
    }

    try {
      // Each width of a page, and its two schemes, read at once — each its own page of the browser: in turn, a look's
      // check of one page at two widths, with its schemes, took 7 s of a 10 s look.
      const checkRoute = async (route: string): Promise<CheckReport[]> => {
        const look = (width: number) => () =>
          checkAt(
            browser,
            where.origin,
            route,
            width,
            {
              ...(options.scheme ? { scheme: options.scheme } : {}),
              ...(options.presence ? { presence: true } : {}),
              ...(options.timezone ? { timezone: options.timezone } : {}),
              ...(options.conditions ? { conditions: options.conditions } : {}),
              ...(options.standIns ? { standIns: true } : {})
            },
            authored,
            options.asked,
            options.ssr,
            options.account,
            options.projectAccount,
            options.click,
            options.expect,
            options.then
          );
        const [read, themed] = await Promise.all([
          Promise.all(
            options.widths.map(async width => {
              const first = await look(width)();
              const failed = first.flatMap(serverErrors);

              // Once, and said: a page red for a second of somebody else's outage is not one red for anything of its own.
              return failed.length > 0 ? (await look(width)()).map(each => ({ ...each, retriedAfter: failed })) : first;
            })
          ),
          // Light and dark, once a page, at its first width: said on its first report, failing it.
          options.themes
            ? themeIssues(browser, where.origin, route, options.widths[0] ?? 1440, {
                standIns: options.standIns === true
              })
            : Promise.resolve([])
        ]);
        const looked = read.flat().map(each => ({ ...each, ...(options.scheme ? { scheme: options.scheme } : {}) }));
        const first = looked.at(0);
        if (first && themed.length > 0) {
          first.issues.push(...themed);
          first.problems.push(...themed.map(issue => issue.message));
          first.ok = false;
        }

        return looked;
      };

      // A few pages at once too, their reports in the order asked: one by one, t-body-type's four took 6.4 s.
      return (
        await inTurns(
          routes.map(route => () => checkRoute(route)),
          ROUTES_AT_ONCE
        )
      ).flat();
    } finally {
      await browser.close();
    }
  } finally {
    where.stop?.();
  }
};
