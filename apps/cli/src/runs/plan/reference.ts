import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { readOptional } from '../core/files';
import { isNumber, isString } from '../core/guards';
import { isRunPlan } from '../core/model';
import { copyOf, runPaths } from '../core/paths';
import { activeRuns } from '../run';

import type { Scheme } from '../../browser';
import type { RunPlan } from '../core/model';
import type { PageDecoration, PageText } from '@plitzi/sdk-authoring';

/**
 * The plan's `reference` site as the run keeps it (`plitzi run reference`): each page of its inventory pictured and its
 * words measured, at each width and scheme, the moment the lead kept it. `page shot --compare` measures against this,
 * not the site as it is now: a run's original redesigned its fighter page after the copy, and a comparison with it
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
  /** Its dress — gradients, glows, ornaments, background images — compared section by section with a page's. */
  decorations: PageDecoration[];
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
  isNumber(value.unloaded) &&
  Array.isArray(value.decorations) &&
  value.decorations.every(layer => isRecord(layer) && isString(layer.kind) && isString(layer.detail));

/**
 * Where the open run that keeps a reference is — the one this copy is of, or one open in the project — and the site it
 * keeps; with `origin`, only the run keeping that site.
 */
const keepingRun = async (
  root: string,
  origin?: string
): Promise<{ dir: string; runId: string; reference: URL } | undefined> => {
  const copy = copyOf(root);
  const project = copy?.root ?? root;
  const runs = copy ? [copy.run] : await activeRuns(project);
  for (const runId of runs) {
    const paths = runPaths(project, runId);
    const text = await readOptional(paths.plan);
    const plan: unknown = text === undefined ? undefined : JSON.parse(text.toString('utf-8'));
    if (isRunPlan(plan) && plan.reference !== undefined) {
      const reference = new URL(plan.reference);
      if (origin === undefined || reference.origin === origin) {
        return { dir: paths.reference, runId, reference };
      }
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
  const run = await keepingRun(root, address.origin);
  if (!run) {
    return undefined;
  }

  const base = path.join(run.dir, keptName(address.pathname, width, scheme));
  const text = await readOptional(`${base}.json`);
  const page: unknown = text === undefined ? undefined : JSON.parse(text.toString('utf-8'));
  const png = await fs.readFile(`${base}.png`).catch(() => undefined);

  return isKeptPage(page) && png ? { png: new Uint8Array(png), page, runId: run.runId } : undefined;
};

/** How far apart two headings' tops may be and still sit on one row. */
const ROW_PX = 4;

/** A text as two spellings of it compare: lower case, no accents, one space between words. */
const comparable = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** How many lines a kept text runs over: its height over its line height, a text of no measurable line height one. */
const linesOf = (text: PageText): number => {
  const lineHeight = Number.parseFloat(text.lineHeight);

  return Number.isFinite(lineHeight) && lineHeight > 0 ? Math.round(text.height / lineHeight) : 1;
};

/**
 * The labels the original itself breaks over two lines or more on the page at `pathname`, at this width — compared as
 * spelt (`comparable`), in either scheme it was kept in: what a copy of it wraps on purpose. Empty outside a run that
 * keeps a reference, or for a page it did not keep. The original's "TARJETAS GRÁFICAS" wraps under its
 * tile, and `label-wraps` told every agent to keep it on one line — two bent the page to it.
 */
export const labelsWrappedInReference = async (root: string, pathname: string, width: number): Promise<Set<string>> => {
  const run = await keepingRun(root);
  if (!run) {
    return new Set();
  }

  const wrapped = new Set<string>();
  for (const scheme of ['light', 'dark'] as const) {
    const text = await readOptional(path.join(run.dir, `${keptName(pathname, width, scheme)}.json`));
    const page: unknown = text === undefined ? undefined : JSON.parse(text.toString('utf-8'));
    if (isKeptPage(page)) {
      for (const each of page.texts) {
        if (linesOf(each) >= 2) {
          wrapped.add(comparable(each.text));
        }
      }
    }
  }

  return wrapped;
};

/** Whether `label` is one the original wraps, as `labelsWrappedInReference` read it. */
export const wrapsAsReference = (wrapped: ReadonlySet<string>, label: string): boolean =>
  wrapped.has(comparable(label));

/** Whether a piece of the inventory names a heading: says it whole, or every word of it longer than two letters. */
const names = (piece: string, heading: string): boolean => {
  const said = comparable(piece);
  const words = comparable(heading)
    .split(' ')
    .filter(word => word.length > 2);

  return said.includes(comparable(heading)) || (words.length > 0 && words.every(word => said.includes(word)));
};

/**
 * Each kept page's headings — its sections, as a reader names them — that no piece of the inventory names, on that
 * page or on none (the shell's): what the plan may have missed. A run's lead left three pieces of the artist page
 * out of the inventory, found only at review.
 */
export const unnamedSections = (
  kept: readonly KeptPage[],
  inventory: NonNullable<RunPlan['inventory']>
): { page: string; headings: string[] }[] =>
  kept.flatMap(page => {
    const pathname = new URL(page.url).pathname;
    const pieces = inventory.filter(item => item.page === undefined || item.page === pathname).map(item => item.piece);
    // A section's heading, as a reader sees it: an h1 or h2 that is drawn — not one kept for screen readers alone (a
    // pixel wide), nor the h3s inside a section (an FAQ's questions, a list's episodes). Each once, however spelled.
    // Nor a card's title: one side by side with another like it — the same tag and size on the same row — is a grid's,
    // as the fighters' names on a list of them; a section's heading has its row to itself.
    const drawn = page.texts.filter(text => /^h[12]$/i.test(text.tag) && text.width > 1 && text.height > 1);
    const beside = (text: PageText): boolean =>
      drawn.some(
        other =>
          other !== text &&
          other.tag === text.tag &&
          other.fontSize === text.fontSize &&
          Math.abs(other.y - text.y) <= ROW_PX
      );
    const seen = new Set<string>();
    const headings = drawn
      .filter(text => !beside(text))
      .map(text => text.text.trim())
      .filter(heading => {
        const key = comparable(heading);
        if (key === '' || seen.has(key)) {
          return false;
        }

        seen.add(key);

        return true;
      })
      .filter(heading => !pieces.some(piece => names(piece, heading)));

    return headings.length > 0 ? [{ page: pathname, headings }] : [];
  });
