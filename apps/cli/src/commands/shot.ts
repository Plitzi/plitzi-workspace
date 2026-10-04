import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { comparePictures, pageRegions } from '@plitzi/sdk-authoring';

import { projectHere } from './existingProject';
import { fail } from './terminal';
import { dataUrl, fromDataUrl, launchBrowser, projectOrigin } from '../browser';

import type { Browser, BrowserPage, Scheme } from '../browser';
import type { PictureDiff, PictureRegion } from '@plitzi/sdk-authoring';

/**
 * `plitzi shot`: a picture of one page of the project — and, asked, the numbers that say what a picture would.
 *
 *   plitzi shot /about --width 390 --scheme dark
 *   plitzi shot / --compare https://example.com --width 1440     # beside another site: how much differs, by section
 *   plitzi shot / --frames 4 --every 500                         # what moves: a marquee, an autoplay
 *   plitzi shot / --clip pricing-table                           # one element, scrolled to wherever it is
 *   plitzi shot / --scroll-to faq --viewport --frames 6          # the screen at that section, as it animates
 *
 * The project's server has to be running (`npm start`). `--json` answers in one object, for a tool or an agent.
 */

export interface ShotOptions {
  /** The numbers and the scheme are validated where the flags are declared (options.ts). */
  width?: number;
  height?: number;
  scheme?: Scheme;
  out?: string;
  compare?: string;
  frames?: number;
  every?: number;
  waitFor?: string;
  reducedMotion?: boolean;
  /** One element only: its name (`data-plitzi-el`) or a CSS selector. */
  clip?: string;
  /** The page scrolled until this element is in view — and, with `viewport`, the screen there. */
  scrollTo?: string;
  /** What fits the viewport, rather than the whole page. */
  viewport?: boolean;
  json?: boolean;
}

/**
 * What a picture holds: the whole page (with its sections, which a diff is reported by), what the screen shows, or one
 * element. Every picture of one run — the first, a compared one, each frame — is taken the same way.
 */
type Framing = { kind: 'page' } | { kind: 'viewport' } | { kind: 'element'; selector: string };

type RegionChange = { name: string; changed: number };

interface ShotReport {
  path: string;
  width: number;
  scheme: Scheme;
  out: string;
  compare?: { url: string; changed: number; regions: RegionChange[]; sideBySide: string; diff: string };
  frames?: { count: number; every: number; moving: RegionChange[]; still: string[] };
}

/** A region moves when more than this share of it changed between two frames: below is anti-aliasing and carets. */
const MOVING_PERCENT = 0.5;

/** A selector, or an element's name — what `data-plitzi-el` carries. */
const selectorOf = (target: string): string => (/^[#.[]/.test(target) ? target : `[data-plitzi-el="${target}"]`);

const pictureOf = async (
  browser: Browser,
  url: string,
  view: {
    width: number;
    height: number;
    scheme: Scheme;
    reducedMotion: boolean;
    waitFor?: string;
    clip?: string;
    scrollTo?: string;
    viewport?: boolean;
  }
): Promise<{ page: BrowserPage; png: Uint8Array } | { problem: string }> => {
  const page = await browser.newPage({
    viewport: { width: view.width, height: view.height },
    colorScheme: view.scheme,
    reducedMotion: view.reducedMotion ? 'reduce' : 'no-preference'
  });
  const answered = await page.goto(url, { waitUntil: 'networkidle' }).catch(() => null);
  if (!answered) {
    return { problem: `Nothing answers at ${url}.` };
  }

  if (view.waitFor) {
    const found = await page.waitForSelector(selectorOf(view.waitFor), { timeout: 10_000 }).catch(() => null);
    if (!found) {
      return { problem: `${view.waitFor} did not appear on ${url} within 10 s.` };
    }
  }

  for (const target of [view.scrollTo, view.clip]) {
    if (target && !(await page.waitForSelector(selectorOf(target), { timeout: 10_000 }).catch(() => null))) {
      return { problem: `${target} is not on ${url}.` };
    }
  }

  if (view.scrollTo) {
    await page.locator(selectorOf(view.scrollTo)).first().scrollIntoViewIfNeeded();
  }

  return { page, png: await capture(page, framing(view)) };
};

const framing = (view: { clip?: string; viewport?: boolean; scrollTo?: string }): Framing => {
  if (view.clip) {
    return { kind: 'element', selector: selectorOf(view.clip) };
  }

  return view.viewport || view.scrollTo ? { kind: 'viewport' } : { kind: 'page' };
};

const capture = (page: BrowserPage, how: Framing): Promise<Uint8Array> => {
  if (how.kind === 'element') {
    return page.locator(how.selector).first().screenshot();
  }

  return page.screenshot({ fullPage: how.kind === 'page' });
};

const regionsText = (regions: { name: string; changed: number }[]): string =>
  regions.map(region => `${region.name} ${String(region.changed)}%`).join(', ');

/** Compared frame to frame: the most each region changed between two that follow each other. */
const framesMoved = (diffs: PictureDiff[]): { name: string; changed: number }[] => {
  const most = new Map<string, number>();
  for (const diff of diffs) {
    for (const region of diff.regions) {
      most.set(region.name, Math.max(most.get(region.name) ?? 0, region.changed));
    }
  }

  return [...most].map(([name, changed]) => ({ name, changed }));
};

export const shot = async (route: string | undefined, options: ShotOptions): Promise<void> => {
  const project = await projectHere('whose page to picture');
  if (!project) {
    return;
  }

  const where = await projectOrigin(project.root, project.plitzi?.kind === 'project' ? project.plitzi : undefined);
  if ('problem' in where) {
    fail(where.problem);

    return;
  }

  const browser = await launchBrowser(project.root);
  if ('problem' in browser) {
    fail(browser.problem);

    return;
  }

  if (options.compare && (options.clip || options.scrollTo || options.viewport)) {
    await browser.close();
    fail(
      '`--compare` sets the whole page beside the other site, section by section: leave out --clip, --scroll-to and --viewport.'
    );

    return;
  }

  try {
    const pathname = route ?? '/';
    const view = {
      width: options.width ?? 1280,
      height: options.height ?? 800,
      scheme: options.scheme ?? 'light',
      reducedMotion: options.reducedMotion === true,
      ...(options.waitFor ? { waitFor: options.waitFor } : {}),
      ...(options.clip ? { clip: options.clip } : {}),
      ...(options.scrollTo ? { scrollTo: options.scrollTo } : {}),
      ...(options.viewport ? { viewport: true } : {})
    };
    const how = framing(view);
    const name = pathname === '/' ? 'home' : pathname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
    const out = path.resolve(
      project.root,
      options.out ?? `visual/.shots/${name}-${String(view.width)}-${view.scheme}.png`
    );
    const base = out.replace(/\.png$/, '');

    const taken = await pictureOf(browser, `${where.origin}${pathname}`, view);
    if ('problem' in taken) {
      fail(`${taken.problem} Start the project first: npm start`);

      return;
    }

    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, taken.png);
    // The sections a diff is told by are the page's: a picture of part of it is one region, named for what it shows.
    const regions: PictureRegion[] = how.kind === 'page' ? await taken.page.evaluate(pageRegions, undefined) : [];
    const report: ShotReport = { path: pathname, width: view.width, scheme: view.scheme, out };

    if (options.compare) {
      const other = new URL(options.compare);
      const target = other.pathname === '/' ? new URL(pathname, other).href : other.href;
      const theirs = await pictureOf(browser, target, view);
      if ('problem' in theirs) {
        fail(theirs.problem);

        return;
      }

      const diff = await comparePictures(taken.page, dataUrl(taken.png), dataUrl(theirs.png), regions);
      await writeFile(`${base}-compare.png`, fromDataUrl(diff.sideBySide));
      await writeFile(`${base}-diff.png`, fromDataUrl(diff.diff));
      report.compare = {
        url: target,
        changed: diff.changed,
        regions: diff.regions,
        sideBySide: `${base}-compare.png`,
        diff: `${base}-diff.png`
      };
    }

    const frames = options.frames ?? 0;
    if (frames > 1) {
      const every = options.every ?? 500;
      const pictures = [taken.png];
      for (let frame = 1; frame < frames; frame += 1) {
        await taken.page.waitForTimeout(every);
        pictures.push(await capture(taken.page, how));
      }

      const diffs: PictureDiff[] = [];
      for (let frame = 1; frame < pictures.length; frame += 1) {
        diffs.push(await comparePictures(taken.page, dataUrl(pictures[frame - 1]), dataUrl(pictures[frame]), regions));
      }

      const whole = how.kind === 'element' ? (options.clip ?? 'element') : 'viewport';
      const moved =
        how.kind === 'page'
          ? framesMoved(diffs)
          : [{ name: whole, changed: Math.max(0, ...diffs.map(diff => diff.changed)) }];
      report.frames = {
        count: frames,
        every,
        moving: moved.filter(region => region.changed > MOVING_PERCENT),
        still: moved.filter(region => region.changed <= MOVING_PERCENT).map(region => region.name)
      };
    }

    if (options.json) {
      console.log(JSON.stringify(report));

      return;
    }

    console.log(out);
    if (report.compare) {
      console.log(
        `${chalk.bold(`${String(report.compare.changed)}% differs`)} from ${report.compare.url}${report.compare.regions.length > 0 ? ` — ${regionsText(report.compare.regions)}` : ''}`
      );
      console.log(chalk.dim(`${report.compare.sideBySide}\n${report.compare.diff}`));
    }

    if (report.frames) {
      console.log(
        report.frames.moving.length > 0
          ? `moving over ${String(report.frames.count)} frames: ${regionsText(report.frames.moving)}`
          : `nothing moved over ${String(report.frames.count)} frames, ${String(report.frames.every)} ms apart`
      );
    }
  } finally {
    await browser.close();
  }
};
