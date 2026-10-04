import chalk from 'chalk';

import {
  authorSpace,
  dataIssues,
  failedFlowText,
  inspectDocument,
  inspectPage,
  readDevTools
} from '@plitzi/sdk-authoring';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { projectHere } from './existingProject';
import { loadProjectSpace } from './projectSpace';
import { fail } from './terminal';
import { launchBrowser, openProjectPage, projectOrigin, withoutDevTools } from '../browser';

import type { Browser, Scheme } from '../browser';
import type { DataIssueCode, DevToolsInput, PageIssue, SpaceHandles } from '@plitzi/sdk-authoring';
import type { Element, Schema } from '@plitzi/sdk-shared';

/**
 * `plitzi check`: whether a page of the running project is whole, said in text — every element it owes on screen, no
 * image broken, nothing scrolling sideways, no text in the colour behind it, no error in the console, no request
 * refused — at each width asked. What an agent needs to know about a page in a few hundred tokens, where a screenshot
 * costs thousands and still has to be looked at; a picture is for when this says something is wrong.
 *
 * With the page's dev tools on (any development server) it also says every flow that failed while the page loaded,
 * every binding that reads a path its provider's answer does not have and each list's rows, and, asked, what the page
 * holds: `--state` (the state, and every source by name) and `--element <id>`. `--ssr` holds the HTML the server sent
 * against the page once hydrated: what a server provider holds and the server's HTML lacked arrived late.
 *
 *   plitzi check / --width 1440,390 --json
 *   plitzi check /products --state --element catalog-count
 *   plitzi check /pricing --ssr
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
  /** The HTML the server sent, held against the page once hydrated. */
  ssr?: boolean;
}

/** One problem of a page, as data: what an agent branches on and points at, beside the sentence a person reads. */
export interface CheckIssue {
  code: PageIssue['code'] | DataIssueCode | 'no-answer' | 'no-page' | 'flow-failed' | 'not-server-rendered';
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
  /** Every list whose rows come from a provider: how many it shows, `null` when it reads nothing. */
  lists: Record<string, number | null>;
  /** With `--ssr`: the elements the page has once hydrated that the server's HTML did not — none of them in a server provider. */
  browserOnly?: string[];
  state?: unknown;
  sources?: Record<string, unknown>;
  element?: unknown;
}

/** The space the project declares, authored: what each page owes (the handles) and what it reads (the schema). */
type Authored = { handles: SpaceHandles; schema: Schema };

/** The space the project declares, authored. Only for one written here. */
const projectSpace = async (root: string): Promise<Authored | { problem: string }> => {
  const project = await loadProjectSpace(root);
  if ('problem' in project) {
    return { problem: `${project.problem} There is nothing to check the page against.` };
  }

  try {
    const { handles, schema } = authorSpace(project.space, { plugins: project.plugins });

    return { handles, schema };
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

/** The elements a piece of HTML carries, by the id each is marked with. */
const markedIn = (html: string): Set<string> =>
  new Set([...html.matchAll(/data-plitzi-el="([^"]+)"/g)].map(([, id]) => id));

/** The `runtime: 'server'` provider an element is inside — or is — if any: what the server's HTML owes. */
const serverProviderOf = (schema: Schema, id: string): string | undefined => {
  const seen = new Set<string>();
  let current = schema.flat[id] as Element | undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.definition.type === 'apiContainer' && current.definition.runtime === 'server') {
      return current.id;
    }

    const parent = current.definition.parentId;
    current = parent ? schema.flat[parent] : undefined;
  }

  return undefined;
};

/**
 * What the page has once hydrated and the server's HTML did not: inside a server provider, an issue per provider — its
 * answer was meant to be in the page as it arrived; anywhere else, what the browser renders on its own, said apart.
 */
const lateElements = (
  schema: Schema | undefined,
  served: Set<string>,
  hydrated: string[],
  width: number
): { issues: CheckIssue[]; browserOnly: string[] } => {
  const late = [...new Set(hydrated)].filter(id => !served.has(id));
  const byProvider = new Map<string, string[]>();
  const browserOnly: string[] = [];
  for (const id of late) {
    const provider = schema ? serverProviderOf(schema, id) : undefined;
    if (provider) {
      byProvider.set(provider, [...(byProvider.get(provider) ?? []), id]);
    } else {
      browserOnly.push(id);
    }
  }

  const issues = [...byProvider].map(([provider, ids]): CheckIssue => ({
    code: 'not-server-rendered',
    message: `apiContainer "${provider}" is resolved on the server, and ${String(ids.length)} of what it holds was not in the HTML the server sent (${ids.slice(0, 6).join(', ')}${ids.length > 6 ? ', …' : ''}) — it arrived after the page, so the first paint and a crawler miss it`,
    elementId: provider,
    width
  }));

  return { issues, browserOnly };
};

const checkAt = async (
  browser: Browser,
  origin: string,
  pathname: string,
  width: number,
  scheme: Scheme | undefined,
  authored: Authored | undefined,
  asked: DevToolsInput,
  ssr: boolean
): Promise<CheckReport> => {
  const handles = authored?.handles;
  const page = await openProjectPage(browser, origin, { width, height: 900, ...(scheme ? { scheme } : {}) });
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
      devTools: false,
      lists: {}
    };
  }

  // What is checked is the page: the dev tools' badge sits over it and is no part of it.
  await withoutDevTools(page);
  const pageId = handles ? pageFor(handles, pathname) : undefined;
  const report = handles && pageId ? await inspectPage(page, handles, { page: pageId }) : await inspectDocument(page);
  // The sources always: what the bindings read is held against them. Printed only when asked.
  const devTools = await readDevTools(page, { ...asked, state: true });
  const data =
    authored && pageId && devTools.sources ? dataIssues(authored.schema, pageId, devTools.sources) : undefined;
  const served = ssr ? markedIn(await (await fetch(`${origin}${pathname}`)).text()) : undefined;
  const late = served
    ? lateElements(
        authored?.schema,
        served,
        await page.evaluate(
          (selector: string) =>
            Array.from(document.querySelectorAll(selector), element => element.getAttribute('data-plitzi-el') ?? ''),
          '[data-plitzi-el]'
        ),
        width
      )
    : undefined;
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
    ...(data?.issues ?? []).map((issue): CheckIssue => ({ ...issue, width })),
    ...(late?.issues ?? []),
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
    lists: data?.lists ?? {},
    ...(late ? { browserOnly: late.browserOnly } : {}),
    ...(!asked.state || devTools.state === undefined ? {} : { state: devTools.state }),
    ...(!asked.state || devTools.sources === undefined ? {} : { sources: devTools.sources }),
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

/** Each list's rows in a few words — `plan-list 3 rows` — so an empty one is seen, not inferred from a box. */
const listsText = (lists: CheckReport['lists']): string[] => {
  const entries = Object.entries(lists);
  if (entries.length === 0) {
    return [];
  }

  const rows = entries.map(
    ([id, count]) => `${id} ${count === null ? 'reads nothing' : `${String(count)} row${count === 1 ? '' : 's'}`}`
  );

  return [chalk.dim(`  · lists: ${rows.join(', ')}`)];
};

/** With `--ssr`, what only the browser renders — not a problem outside a server provider, and said so it is seen. */
const browserOnlyText = (report: CheckReport): string[] =>
  report.browserOnly && report.browserOnly.length > 0
    ? [
        chalk.dim(
          `  · rendered only in the browser, outside any server provider: ${report.browserOnly.slice(0, 10).join(', ')}${report.browserOnly.length > 10 ? `, … (${String(report.browserOnly.length)})` : ''}`
        )
      ]
    : [];

const reportText = (report: CheckReport, asked: DevToolsInput): string => {
  const head = `${report.path} at ${String(report.width)} px`;
  const held = [...listsText(report.lists), ...browserOnlyText(report), ...heldText(report, asked)];
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

  const authored = plitzi?.source === 'local' ? await projectSpace(project.root) : undefined;
  if (authored && 'problem' in authored) {
    fail(authored.problem);

    return;
  }

  const browser = await launchBrowser(project.root);
  if ('problem' in browser) {
    fail(browser.problem);

    return;
  }

  try {
    const widths = options.width ?? [1440, 390];
    const { scheme } = options;
    const asked: DevToolsInput = {
      state: Boolean(options.state),
      ...(options.element ? { element: options.element } : {})
    };
    const reports: CheckReport[] = [];
    for (const width of widths) {
      reports.push(
        await checkAt(browser, where.origin, route ?? '/', width, scheme, authored, asked, Boolean(options.ssr))
      );
    }

    console.log(options.json ? JSON.stringify(reports) : reports.map(report => reportText(report, asked)).join('\n'));
    if (reports.some(report => !report.ok)) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
};
