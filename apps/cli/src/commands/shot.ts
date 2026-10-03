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
  json?: boolean;
}

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
  view: { width: number; height: number; scheme: Scheme; reducedMotion: boolean; waitFor?: string }
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

  return { page, png: await page.screenshot({ fullPage: true }) };
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

  try {
    const pathname = route ?? '/';
    const view = {
      width: options.width ?? 1280,
      height: options.height ?? 800,
      scheme: options.scheme ?? 'light',
      reducedMotion: options.reducedMotion === true,
      ...(options.waitFor ? { waitFor: options.waitFor } : {})
    };
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
    const regions: PictureRegion[] = await taken.page.evaluate(pageRegions, undefined);
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
        pictures.push(await taken.page.screenshot({ fullPage: true }));
      }

      const diffs: PictureDiff[] = [];
      for (let frame = 1; frame < pictures.length; frame += 1) {
        diffs.push(await comparePictures(taken.page, dataUrl(pictures[frame - 1]), dataUrl(pictures[frame]), regions));
      }

      const moved = framesMoved(diffs);
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
