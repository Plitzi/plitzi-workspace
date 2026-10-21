import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { readOptional } from './files';
import { isNumber, isString } from './guards';
import { isRunPlan } from './model';
import { copyOf, runPaths } from './paths';
import { activeRuns } from './run';

import type { RunPlan } from './model';
import type { Scheme } from '../browser';
import type { PageText } from '@plitzi/sdk-authoring';

/**
 * The plan's `reference` site as the run keeps it (`plitzi run reference`): each page of its inventory pictured and its
 * words measured, at each width and scheme, the moment the lead kept it. `page shot --compare` measures against this,
 * not the site as it is now: la-velada's original redesigned its fighter page after the copy, and a comparison with it
 * measured another page. In the run's folder: gone with the run when it finishes.
 */
export interface KeptPage {
  url: string;
  width: number;
  scheme: Scheme;
  at: string;
  texts: PageText[];
  /** Its pictures that had not loaded when it was kept: those parts compare against a hole. */
  unloaded: number;
}

/** The widths a page is kept at: the desktop and the phone a review looks at. */
export const REFERENCE_WIDTHS = [1440, 390] as const;

/** Where a kept page is, by its path, width and scheme — `boxeadores-alondrissa-1440-dark`. */
export const keptName = (pathname: string, width: number, scheme: Scheme): string =>
  `${pathname === '/' ? 'home' : pathname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}-${String(width)}-${scheme}`;

/** The pages of the reference to keep: its home, and each page the plan's inventory names — a pattern is no page. */
export const referencePages = (plan: Pick<RunPlan, 'inventory'>): string[] => [
  ...new Set([
    '/',
    ...(plan.inventory ?? []).flatMap(item =>
      item.page && item.page.startsWith('/') && !/[:{*]/.test(item.page) ? [item.page] : []
    )
  ])
];

const isPageTexts = (value: unknown): value is PageText[] =>
  Array.isArray(value) && value.every(text => isRecord(text) && isString(text.text) && isNumber(text.y));

const isKeptPage = (value: unknown): value is KeptPage =>
  isRecord(value) &&
  isString(value.url) &&
  isNumber(value.width) &&
  (value.scheme === 'light' || value.scheme === 'dark') &&
  isString(value.at) &&
  isPageTexts(value.texts) &&
  isNumber(value.unloaded);

/** Where the open run that keeps `url`'s site is — the one this copy is of, or one open in the project. */
const keepingRun = async (root: string, url: URL): Promise<{ dir: string; runId: string } | undefined> => {
  const copy = copyOf(root);
  const project = copy?.root ?? root;
  const runs = copy ? [copy.run] : await activeRuns(project);
  for (const runId of runs) {
    const paths = runPaths(project, runId);
    const text = await readOptional(paths.plan);
    const plan: unknown = text === undefined ? undefined : JSON.parse(text.toString('utf-8'));
    if (isRunPlan(plan) && plan.reference !== undefined && new URL(plan.reference).origin === url.origin) {
      return { dir: paths.reference, runId };
    }
  }

  return undefined;
};

/** The page at `url` as the run kept it at this width and scheme: its picture and its words — or nothing kept. */
export const keptPage = async (
  root: string,
  url: string,
  width: number,
  scheme: Scheme
): Promise<{ png: Uint8Array; page: KeptPage; runId: string } | undefined> => {
  const address = new URL(url);
  const run = await keepingRun(root, address);
  if (!run) {
    return undefined;
  }

  const base = path.join(run.dir, keptName(address.pathname, width, scheme));
  const text = await readOptional(`${base}.json`);
  const page: unknown = text === undefined ? undefined : JSON.parse(text.toString('utf-8'));
  const png = await fs.readFile(`${base}.png`).catch(() => undefined);

  return isKeptPage(page) && png ? { png: new Uint8Array(png), page, runId: run.runId } : undefined;
};
