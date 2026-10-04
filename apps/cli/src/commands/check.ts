import chalk from 'chalk';

import { authorSpace, failedFlowText, inspectDocument, inspectPage, readDevTools } from '@plitzi/sdk-authoring';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { projectHere } from './existingProject';
import { loadProjectSpace } from './projectSpace';
import { fail } from './terminal';
import { launchBrowser, projectOrigin } from '../browser';

import type { Browser, Scheme } from '../browser';
import type { DevToolsInput, PageIssue, SpaceHandles } from '@plitzi/sdk-authoring';

/**
 * `plitzi check`: whether a page of the running project is whole, said in text — every element it owes on screen, no
 * image broken, nothing scrolling sideways, no text in the colour behind it, no error in the console, no request
 * refused — at each width asked. What an agent needs to know about a page in a few hundred tokens, where a screenshot
 * costs thousands and still has to be looked at; a picture is for when this says something is wrong.
 *
 * With the page's dev tools on (any development server) it also says every flow that failed while the page loaded,
 * and, asked, what the page holds: `--state` (the state, and every source by name) and `--element <id>`.
 *
 *   plitzi check / --width 1440,390 --json
 *   plitzi check /products --state --element catalog-count
 */

export interface CheckOptions {
  /** Validated where the flag is declared (`widths` in options.ts). */
  width?: number[];
  scheme?: Scheme;
  json?: boolean;
  /** The page's state and every source by name, as its dev tools hold them. */
  state?: boolean;
  /** One element by its id: what it reads, its own state, whether it is on screen. */
  element?: string;
}

/** One problem of a page, as data: what an agent branches on and points at, beside the sentence a person reads. */
export interface CheckIssue {
  code: PageIssue['code'] | 'no-answer' | 'no-page' | 'flow-failed';
  message: string;
  /** The space's element it is about, by id — absent for one about the page as a whole. */
  elementId?: string;
  /** The width it was found at, so a list of every width's issues still says where each one is. */
  width: number;
}

export interface CheckReport {
  path: string;
  width: number;
  ok: boolean;
  /** The elements the space owes this page that were looked for — 0 for a space that is not in the project. */
  checked: number;
  /** The problems as sentences — each `issues` entry's `message`. */
  problems: string[];
  issues: CheckIssue[];
  /** Owed, and hidden at this width by a breakpoint on purpose: looked at, and not a problem. */
  hiddenAtWidth: string[];
  consoleErrors: string[];
  failedRequests: string[];
  /** Whether the page had its dev tools on, which is what flows, state and elements are read from. */
  devTools: boolean;
  state?: unknown;
  sources?: Record<string, unknown>;
  element?: unknown;
}

/** The space the project declares, authored — the handles say what each page owes. Only for one written here. */
const projectHandles = async (root: string): Promise<SpaceHandles | { problem: string }> => {
  const project = await loadProjectSpace(root);
  if ('problem' in project) {
    return { problem: `${project.problem} There is nothing to check the page against.` };
  }

  try {
    return authorSpace(project.space, { plugins: project.plugins }).handles;
  } catch (error) {
    return {
      problem: `The space does not author — npm run author says why: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`
    };
  }
};

/** The page a path is, `:slug` and `{{slug}}` matching any segment. */
const pageFor = (handles: SpaceHandles, pathname: string): string | undefined => {
  const wanted = pathname.replace(/\/$/, '').split('/');

  return Object.values(handles.pages).find(page => {
    const segments = page.path.replace(/\/$/, '').split('/');

    return (
      segments.length === wanted.length &&
      segments.every(
        (segment, index) => segment.startsWith(':') || /^\{\{.*\}\}$/.test(segment) || segment === wanted[index]
      )
    );
  })?.id;
};

const checkAt = async (
  browser: Browser,
  origin: string,
  pathname: string,
  width: number,
  scheme: Scheme,
  handles: SpaceHandles | undefined,
  asked: DevToolsInput
): Promise<CheckReport> => {
  const page = await browser.newPage({
    viewport: { width, height: 900 },
    colorScheme: scheme,
    reducedMotion: 'no-preference'
  });
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on('pageerror', error => consoleErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('response', response => {
    if (response.status() >= 400 && response.url().startsWith(origin)) {
      failedRequests.push(`${String(response.status())} ${response.url().slice(origin.length)}`);
    }
  });

  const answered = await page.goto(`${origin}${pathname}`, { waitUntil: 'networkidle' }).catch(() => null);
  if (!answered) {
    const issue: CheckIssue = { code: 'no-answer', message: `nothing answers at ${origin}${pathname}`, width };

    return {
      path: pathname,
      width,
      ok: false,
      checked: 0,
      problems: [issue.message],
      issues: [issue],
      hiddenAtWidth: [],
      consoleErrors,
      failedRequests,
      devTools: false
    };
  }

  const pageId = handles ? pageFor(handles, pathname) : undefined;
  const report = handles && pageId ? await inspectPage(page, handles, { page: pageId }) : await inspectDocument(page);
  const devTools = await readDevTools(page, asked);
  const noPage: CheckIssue[] =
    handles && !pageId ? [{ code: 'no-page', message: `no page of the space answers at ${pathname}`, width }] : [];
  const failedFlows = devTools.flows
    .filter(flow => flow.status === 'failed')
    .map((flow): CheckIssue => ({
      code: 'flow-failed',
      message: failedFlowText(flow),
      ...(flow.on === undefined ? {} : { elementId: flow.on }),
      width
    }));
  const issues: CheckIssue[] = [
    ...noPage,
    ...report.issues.map((issue): CheckIssue => ({ ...issue, width })),
    ...failedFlows
  ];

  return {
    path: pathname,
    width,
    ok: issues.length === 0 && consoleErrors.length === 0 && failedRequests.length === 0,
    checked: report.checked,
    problems: issues.map(issue => issue.message),
    issues,
    hiddenAtWidth: report.hiddenAtWidth,
    consoleErrors,
    failedRequests,
    devTools: devTools.available,
    ...(devTools.state === undefined ? {} : { state: devTools.state }),
    ...(devTools.sources === undefined ? {} : { sources: devTools.sources }),
    ...(devTools.element === undefined ? {} : { element: devTools.element })
  };
};

/** What the page holds, when it was asked for: one compact line each, the shape of a source rather than its rows. */
const heldText = (report: CheckReport, asked: DevToolsInput): string[] => {
  if (!asked.state && asked.element === undefined) {
    return [];
  }

  if (!report.devTools) {
    return ['  · the page has no dev tools on (debug mode), so its state and elements cannot be read'];
  }

  return [
    ...(report.state === undefined ? [] : [`  · state ${JSON.stringify(report.state)}`]),
    ...Object.entries(report.sources ?? {}).map(([name, value]) => `  · source ${name}: ${shapeOf(value)}`),
    ...(asked.element === undefined ? [] : [`  · element ${asked.element}: ${JSON.stringify(report.element ?? null)}`])
  ];
};

/** A value's shape in a few words: a list's length, an object's keys, a short value as it is. */
const shapeOf = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `a list of ${String(value.length)}`;
  }

  if (isRecord(value)) {
    const keys = Object.keys(value);

    return `{ ${keys.slice(0, 8).join(', ')}${keys.length > 8 ? ', …' : ''} }`;
  }

  const text = value === undefined ? 'undefined' : JSON.stringify(value);

  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
};

const reportText = (report: CheckReport, asked: DevToolsInput): string => {
  const head = `${report.path} at ${String(report.width)} px`;
  const held = heldText(report, asked);
  const atWidth =
    report.hiddenAtWidth.length > 0
      ? chalk.dim(`  · hidden at this width by a breakpoint, on purpose: ${report.hiddenAtWidth.join(', ')}`)
      : undefined;
  if (report.ok) {
    return [
      chalk.green(
        `✓ ${head} — ${report.checked > 0 ? `${String(report.checked)} elements on screen, ` : ''}nothing wrong`
      ),
      ...(atWidth ? [atWidth] : []),
      ...held
    ].join('\n');
  }

  return [
    chalk.red(`✗ ${head}`),
    ...report.problems.map(problem => `  - ${problem}`),
    ...report.consoleErrors.map(error => `  - console: ${error}`),
    ...report.failedRequests.map(request => `  - request refused: ${request}`),
    ...held
  ].join('\n');
};

export const check = async (route: string | undefined, options: CheckOptions): Promise<void> => {
  const project = await projectHere('whose page to check');
  if (!project) {
    return;
  }

  const plitzi = project.plitzi?.kind === 'project' ? project.plitzi : undefined;
  const where = await projectOrigin(project.root, plitzi);
  if ('problem' in where) {
    fail(where.problem);

    return;
  }

  const handles = plitzi?.source === 'local' ? await projectHandles(project.root) : undefined;
  if (handles && 'problem' in handles) {
    fail(handles.problem);

    return;
  }

  const browser = await launchBrowser(project.root);
  if ('problem' in browser) {
    fail(browser.problem);

    return;
  }

  try {
    const widths = options.width ?? [1440, 390];
    const scheme = options.scheme ?? 'light';
    const asked: DevToolsInput = {
      state: Boolean(options.state),
      ...(options.element ? { element: options.element } : {})
    };
    const reports: CheckReport[] = [];
    for (const width of widths) {
      reports.push(await checkAt(browser, where.origin, route ?? '/', width, scheme, handles, asked));
    }

    console.log(options.json ? JSON.stringify(reports) : reports.map(report => reportText(report, asked)).join('\n'));
    if (reports.some(report => !report.ok)) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
};
