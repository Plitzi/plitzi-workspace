import path from 'node:path';
import { pathToFileURL } from 'node:url';

import chalk from 'chalk';

import { authorSpace, inspectDocument, inspectPage } from '@plitzi/sdk-authoring';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { findProject } from './existingProject';
import { launchBrowser, projectOrigin } from '../browser';

import type { Browser, Scheme } from '../browser';
import type { PluginDeclarationData, SpaceHandles, SpaceSpec } from '@plitzi/sdk-authoring';

/**
 * `plitzi check`: whether a page of the running project is whole, said in text — every element it owes on screen, no
 * image broken, nothing scrolling sideways, no text in the colour behind it, no error in the console, no request
 * refused — at each width asked. What an agent needs to know about a page in a few hundred tokens, where a screenshot
 * costs thousands and still has to be looked at; a picture is for when this says something is wrong.
 *
 *   plitzi check / --width 1440,390 --json
 */

export interface CheckOptions {
  width?: string;
  scheme?: string;
  json?: boolean;
}

export interface CheckReport {
  path: string;
  width: number;
  ok: boolean;
  /** The elements the space owes this page that were looked for — 0 for a space that is not in the project. */
  checked: number;
  problems: string[];
  consoleErrors: string[];
  failedRequests: string[];
}

/**
 * What the module exports as `space`, taken as a declaration when it has the shape of one. `authorSpace` checks the
 * rest of it, field by field, and says what is wrong — so this only has to tell a space from anything else.
 */
const isSpaceSpec = (value: unknown): value is SpaceSpec =>
  isRecord(value) &&
  typeof value.name === 'string' &&
  typeof value.permanentUrl === 'string' &&
  Array.isArray(value.pages);

const isDeclarations = (value: unknown): value is PluginDeclarationData[] =>
  Array.isArray(value) && value.every(entry => isRecord(entry) && typeof entry.type === 'string');

const importProject = async (file: string): Promise<unknown> => import(pathToFileURL(file).href);

/** The space the project declares, authored — the handles say what each page owes. Only for one written here. */
const projectHandles = async (root: string): Promise<SpaceHandles | { problem: string }> => {
  const module = await importProject(path.join(root, 'src/space.ts'));
  const space = isRecord(module) ? module.space : undefined;
  if (!isSpaceSpec(space)) {
    return { problem: 'src/space.ts exports no `space` to check the page against.' };
  }

  const registry = await importProject(path.join(root, 'src/plugins/declarations.ts')).catch(() => undefined);
  const declarations = isRecord(registry) ? registry.declarations : undefined;
  try {
    return authorSpace(space, isDeclarations(declarations) ? { plugins: declarations } : {}).handles;
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
  handles: SpaceHandles | undefined
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
    return {
      path: pathname,
      width,
      ok: false,
      checked: 0,
      problems: [`nothing answers at ${origin}${pathname}`],
      consoleErrors,
      failedRequests
    };
  }

  const pageId = handles ? pageFor(handles, pathname) : undefined;
  const report = handles && pageId ? await inspectPage(page, handles, { page: pageId }) : await inspectDocument(page);
  const problems =
    handles && !pageId ? [`no page of the space answers at ${pathname}`, ...report.problems] : report.problems;

  return {
    path: pathname,
    width,
    ok: problems.length === 0 && consoleErrors.length === 0 && failedRequests.length === 0,
    checked: report.checked,
    problems,
    consoleErrors,
    failedRequests
  };
};

const reportText = (report: CheckReport): string => {
  const head = `${report.path} at ${String(report.width)} px`;
  if (report.ok) {
    return chalk.green(
      `✓ ${head} — ${report.checked > 0 ? `${String(report.checked)} elements on screen, ` : ''}nothing wrong`
    );
  }

  return [
    chalk.red(`✗ ${head}`),
    ...report.problems.map(problem => `  - ${problem}`),
    ...report.consoleErrors.map(error => `  - console: ${error}`),
    ...report.failedRequests.map(request => `  - request refused: ${request}`)
  ].join('\n');
};

export const check = async (route: string | undefined, options: CheckOptions): Promise<void> => {
  const fail = (problem: string): void => {
    console.error(chalk.red(problem));
    process.exitCode = 1;
  };

  const project = await findProject(process.cwd());
  if (!project) {
    fail('There is no package.json here or above: run this in the project whose page to check.');

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
    const widths = (options.width ?? '1440,390')
      .split(',')
      .map(Number)
      .filter(width => Number.isFinite(width) && width > 0);
    const scheme: Scheme = options.scheme === 'dark' ? 'dark' : 'light';
    const reports: CheckReport[] = [];
    for (const width of widths) {
      reports.push(await checkAt(browser, where.origin, route ?? '/', width, scheme, handles));
    }

    console.log(options.json ? JSON.stringify(reports) : reports.map(reportText).join('\n'));
    if (reports.some(report => !report.ok)) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
};
