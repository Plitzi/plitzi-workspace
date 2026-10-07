import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import {
  comparePictures,
  compareTexts,
  loadImages,
  openPage,
  PAGE_TEXT_LIMIT,
  pageRegions,
  pageTexts,
  unrollPage
} from '@plitzi/sdk-authoring';
import { MOTION_STILL_CSS } from '@plitzi/sdk-shared/schema/motion';

import { projectHere } from './existingProject';
import { fail } from './terminal';
import {
  dataUrl,
  fromDataUrl,
  launchBrowser,
  openProjectPage,
  paintedScheme,
  projectOrigin,
  withoutDevTools
} from '../browser';
import { PROJECT_TMP } from '../scaffold/paths';

import type { Browser, BrowserPage, Scheme } from '../browser';
import type { PictureDiff, PictureRegion, TextComparison, TextDifference } from '@plitzi/sdk-authoring';

/**
 * `plitzi page shot`: a picture of one page of the project — and, asked, the numbers that say what a picture would.
 *
 *   plitzi page shot /about --width 390 --scheme dark
 *   plitzi page shot / --compare https://example.com --width 1440     # beside another site: what differs, and how
 *   plitzi page shot / --frames 4 --every 500                         # what moves: a marquee, an autoplay
 *   plitzi page shot / --clip pricing-table                           # one element, scrolled to wherever it is
 *   plitzi page shot / --scroll-to faq --viewport --frames 6          # the screen at that section, as it animates
 *
 * The project's server has to be running (`npm start`). `--json` answers in one object, for a tool or an agent. The
 * dev tools' badge is never in the picture; a picture of the whole page has every lazy image loaded and shows every
 * arrival that waits for the scroll as it ends — taken without scrolling, they would be holes where the sections are.
 */

export interface ShotOptions {
  /** The numbers and the scheme are validated where the flags are declared (options.ts). */
  width?: number;
  height?: number;
  /** The space's theme. Left out, the space's own default — and the file is named by the one painted. */
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
  /**
   * Elements clicked one after another once the page settles — each its name or a CSS selector, which reaches inside a
   * plugin too — with what each click changed pictured: `frames` pictures `every` ms apart after each, or one.
   */
  click?: string[];
  /** Every picture taken — before, after each click, or each of `frames` — on one contact sheet. */
  sheet?: boolean;
  json?: boolean;
}

/**
 * What a picture holds: the whole page (with its sections, which a diff is reported by), what the screen shows, or one
 * element. Every picture of one run — the first, a compared one, each frame — is taken the same way.
 */
type Framing = { kind: 'page' } | { kind: 'viewport' } | { kind: 'element'; selector: string };

type RegionChange = { name: string; changed: number; shift?: number };

interface CompareReport {
  url: string;
  changed: number;
  /** How tall each page is: two pages of different heights are compared section by section. */
  heights: { here: number; there: number };
  /** The first section the other page has somewhere else, and how far down. */
  driftFrom?: { name: string; shift: number };
  regions: RegionChange[];
  /** The words both pages have, and what each does differently there. */
  texts: TextComparison;
  /** Pictures the other page had not drawn when it was taken. */
  unloaded: number;
  sideBySide: string;
  diff: string;
}

interface ShotReport {
  path: string;
  width: number;
  /** The theme the page was painted in. */
  scheme: Scheme;
  out: string;
  compare?: CompareReport;
  frames?: { count: number; every: number; moving: RegionChange[]; still: string[] };
  /** How many arrivals that wait for the scroll (`on: 'view'` or `'scroll'`) the whole-page picture shows as they end. */
  settled?: number;
  /** Pictures of this page not drawn when it was taken. */
  unloaded?: number;
  /** With `click`: each element clicked, and the share of the picture that changed after it. */
  clicked?: { target: string; changed: number }[];
  /** The pictures after the first, each with what it shows — or, with `sheet`, the one sheet that holds them all. */
  pictures?: { label: string; out: string }[];
  sheet?: string;
}

/** One picture of a page as it plays: what it shows — `before`, `<target> +250 ms` — and the picture. */
interface Moment {
  label: string;
  png: Uint8Array;
}

interface View {
  width: number;
  height: number;
  scheme?: Scheme;
  reducedMotion: boolean;
  waitFor?: string;
  clip?: string;
  scrollTo?: string;
  viewport?: boolean;
  /** Every declared motion held at its end: a whole page taken in one picture, never scrolled. */
  still: boolean;
}

interface Taken {
  page: BrowserPage;
  png: Uint8Array;
  scheme: Scheme;
  settled: number;
  unloaded: number;
}

/** A region moves when more than this share of it changed between two frames: below is anti-aliasing and carets. */
const MOVING_PERCENT = 0.5;

/** How long a whole page waits for its pictures before it is taken anyway. */
const IMAGES_BUDGET_MS = 8000;

/** How many texts that differ are written out; `--json` has every one. */
const TEXTS_SHOWN = 12;

/** A shift within this is where it was: a pixel or two is rounding. */
const DRIFT_PX = 2;

/** An arrival that waits for the scroll and has not had it: one waiting to be seen, or one tied to the scroll. */
const WAITING_FOR_SCROLL = '[data-motion-on="view"]:not([data-motion-seen]), [data-motion-on="scroll"]';

/** A selector, or an element's name — what `data-plitzi-el` carries. */
const selectorOf = (target: string): string => (/^[#.[]/.test(target) ? target : `[data-plitzi-el="${target}"]`);

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

/**
 * One page, pictured: the project's own (`origin` given — in the space's theme when one is asked for) or another site,
 * in the scheme it is told.
 */
const pictureOf = async (
  browser: Browser,
  url: string,
  view: View,
  origin?: string
): Promise<Taken | { problem: string }> => {
  const page = origin
    ? await openProjectPage(browser, origin, view)
    : await browser.newPage({
        viewport: { width: view.width, height: view.height },
        colorScheme: view.scheme ?? 'light',
        reducedMotion: view.reducedMotion ? 'reduce' : 'no-preference'
      });
  // Settled, not `networkidle`: a page with a live channel keeps its stream open, and never idles.
  const answered = await openPage(page, url);
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

  await withoutDevTools(page);
  // Counted before the walk below, which shows every one of them.
  const settled = view.still
    ? await page.evaluate((selector: string) => document.querySelectorAll(selector).length, WAITING_FOR_SCROLL)
    : 0;
  // A whole page is taken without scrolling: a lazy picture below the fold would be a hole, and an arrival waiting
  // for the scroll would be one too. Loaded, unrolled (the SDK scrolls a pane of its own, which a full-page picture
  // cannot extend) and held at its end, the page is what a reader scrolling down ends up seeing.
  const whole = framing(view).kind === 'page';
  const pictures = whole ? await page.evaluate(loadImages, IMAGES_BUDGET_MS) : undefined;
  if (whole) {
    await page.evaluate(unrollPage, undefined);
  }

  if (view.still) {
    await page.addStyleTag({ content: MOTION_STILL_CSS });
  }

  return {
    page,
    png: await capture(page, framing(view)),
    scheme: await paintedScheme(page, view.scheme ?? 'light'),
    settled,
    unloaded: pictures?.missing ?? 0
  };
};

const shiftText = (shift: number | undefined): string =>
  shift !== undefined && Math.abs(shift) > DRIFT_PX ? ` (${shift > 0 ? '+' : ''}${String(shift)}px there)` : '';

const regionsText = (regions: RegionChange[]): string =>
  regions.map(region => `${region.name} ${String(region.changed)}%${shiftText(region.shift)}`).join(', ');

/** Compared frame to frame: the most each region changed between two that follow each other. */
const framesMoved = (diffs: PictureDiff[]): RegionChange[] => {
  const most = new Map<string, number>();
  for (const diff of diffs) {
    for (const region of diff.regions) {
      most.set(region.name, Math.max(most.get(region.name) ?? 0, region.changed));
    }
  }

  return [...most].map(([name, changed]) => ({ name, changed }));
};

const differenceText = (entry: TextDifference): string =>
  `  ${entry.tag} ${JSON.stringify(entry.text.length > 48 ? `${entry.text.slice(0, 47)}…` : entry.text)} — ${entry.differences.join(' · ')}`;

const someOf = (texts: string[]): string => {
  const shown = texts.slice(0, 3).map(text => JSON.stringify(text.length > 32 ? `${text.slice(0, 31)}…` : text));

  return `${shown.join(', ')}${texts.length > 3 ? ` (+${String(texts.length - 3)})` : ''}`;
};

/** What a comparison found, in the lines an agent reads before it opens a picture. */
const compareText = (compare: CompareReport): string[] => {
  const lines = [
    `${chalk.bold(`${String(compare.changed)}% differs`)} from ${compare.url}${compare.regions.length > 0 ? ` — ${regionsText(compare.regions)}` : ''}`
  ];
  const longer = compare.heights.there - compare.heights.here;
  const drift = compare.driftFrom;
  const placed = [
    Math.abs(longer) > DRIFT_PX
      ? `the page there is ${String(Math.abs(longer))}px ${longer > 0 ? 'longer' : 'shorter'} (${String(compare.heights.here)} → ${String(compare.heights.there)})`
      : '',
    drift
      ? `from ${drift.name} on, it sits ${String(Math.abs(drift.shift))}px ${drift.shift > 0 ? 'lower' : 'higher'} there — each section is compared where it is`
      : ''
  ].filter(Boolean);
  if (placed.length > 0) {
    lines.push(placed.join('; '));
  }

  const { texts } = compare;
  if (texts.differ.length > 0) {
    lines.push(
      `texts: ${String(texts.same)} the same, ${String(texts.differ.length)} differ (here → there):`,
      ...texts.differ.slice(0, TEXTS_SHOWN).map(differenceText),
      ...(texts.differ.length > TEXTS_SHOWN
        ? [chalk.dim(`  …and ${String(texts.differ.length - TEXTS_SHOWN)} more: --json lists them`)]
        : [])
    );
  } else if (texts.same > 0) {
    lines.push(`texts: the ${String(texts.same)} both pages have look the same`);
  }

  if (texts.onlyHere.length > 0 || texts.onlyThere.length > 0) {
    lines.push(
      chalk.dim(
        [
          texts.onlyHere.length > 0 ? `only here: ${someOf(texts.onlyHere)}` : '',
          texts.onlyThere.length > 0 ? `only there: ${someOf(texts.onlyThere)}` : ''
        ]
          .filter(Boolean)
          .join(' · ')
      )
    );
  }

  if (compare.unloaded > 0) {
    lines.push(
      chalk.yellow(
        `${String(compare.unloaded)} picture(s) there had not loaded when it was taken: those parts compare against a hole`
      )
    );
  }

  lines.push(chalk.dim(`${compare.sideBySide}\n${compare.diff}`));

  return lines;
};

/** The other site beside this page: section by section where each one is, and the words both have, measured. */
const compareWith = async (
  browser: Browser,
  taken: Taken,
  target: string,
  view: View,
  regions: PictureRegion[],
  base: string
): Promise<CompareReport | { problem: string }> => {
  // Their page in the theme ours was painted in: two schemes are not a difference worth reporting.
  const theirs = await pictureOf(browser, target, { ...view, scheme: taken.scheme });
  if ('problem' in theirs) {
    return theirs;
  }

  const diff = await comparePictures(taken.page, dataUrl(taken.png), dataUrl(theirs.png), { regions, align: true });
  await writeFile(`${base}-compare.png`, fromDataUrl(diff.sideBySide));
  await writeFile(`${base}-diff.png`, fromDataUrl(diff.diff));
  const rowShift = diff.rowShift ?? [];
  const shiftAt = (y: number): number => rowShift[Math.min(Math.max(0, Math.round(y)), rowShift.length - 1)] ?? 0;
  const texts = compareTexts(
    await taken.page.evaluate(pageTexts, PAGE_TEXT_LIMIT),
    await theirs.page.evaluate(pageTexts, PAGE_TEXT_LIMIT),
    shiftAt
  );

  return {
    url: target,
    changed: diff.changed,
    heights: { here: diff.heights.a, there: diff.heights.b },
    ...(diff.driftFrom ? { driftFrom: diff.driftFrom } : {}),
    regions: diff.regions,
    texts,
    unloaded: theirs.unloaded,
    sideBySide: `${base}-compare.png`,
    diff: `${base}-diff.png`
  };
};

/**
 * The pictures on one sheet, each under what it shows, four to a row and each 360 px wide: runs in the page, so it is
 * self-contained — no import, nothing it closes over.
 */
function contactSheet(cells: { label: string; src: string }[]): Promise<string> {
  const CELL_WIDTH = 360;
  const LABEL = 24;
  const GAP = 12;
  const load = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('a picture of the sheet did not load'));
      image.src = src;
    });

  return Promise.all(cells.map(cell => load(cell.src))).then(images => {
    const columns = Math.min(4, images.length);
    const heightOf = (image: HTMLImageElement) => Math.round((image.naturalHeight * CELL_WIDTH) / image.naturalWidth);
    const cellHeight = Math.max(...images.map(heightOf));
    const rows = Math.ceil(images.length / columns);
    const canvas = document.createElement('canvas');
    canvas.width = GAP + columns * (CELL_WIDTH + GAP);
    canvas.height = GAP + rows * (LABEL + cellHeight + GAP);
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('no canvas to draw the sheet on');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = '13px ui-monospace, monospace';
    images.forEach((image, index) => {
      const x = GAP + (index % columns) * (CELL_WIDTH + GAP);
      const y = GAP + Math.floor(index / columns) * (LABEL + cellHeight + GAP);
      context.fillStyle = '#16181d';
      context.fillText(cells[index].label, x, y + 16);
      context.drawImage(image, x, y + LABEL, CELL_WIDTH, heightOf(image));
      context.strokeStyle = '#d0d4dc';
      context.strokeRect(x + 0.5, y + LABEL + 0.5, CELL_WIDTH - 1, heightOf(image) - 1);
    });

    return canvas.toDataURL('image/png');
  });
}

/**
 * Each element clicked in turn, and the page pictured after it — `frames` pictures `every` ms apart, or one. What a
 * click changed is measured against the picture before it: nothing at all is said, as a click that did nothing.
 */
const clickThrough = async (
  taken: Taken,
  how: Framing,
  clicks: readonly string[],
  { frames, every }: { frames: number; every: number }
): Promise<{ moments: Moment[]; clicked: { target: string; changed: number }[] } | { problem: string }> => {
  const moments: Moment[] = [{ label: 'before', png: taken.png }];
  const clicked: { target: string; changed: number }[] = [];
  for (const target of clicks) {
    const element = taken.page.locator(selectorOf(target)).first();
    if ((await element.count()) === 0) {
      return { problem: `${target} is not on the page: --click takes an element's name or a CSS selector.` };
    }

    const before = moments[moments.length - 1].png;
    try {
      await element.click({ timeout: 3000 });
    } catch (error) {
      return {
        problem: `${target} could not be clicked — hidden, covered or disabled: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`
      };
    }

    for (let frame = 1; frame <= Math.max(1, frames); frame += 1) {
      await taken.page.waitForTimeout(every);
      moments.push({ label: `${target} +${String(frame * every)} ms`, png: await capture(taken.page, how) });
    }

    const after = moments[moments.length - 1].png;
    clicked.push({ target, changed: (await comparePictures(taken.page, dataUrl(before), dataUrl(after))).changed });
  }

  return { moments, clicked };
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

  const clicks = options.click ?? [];
  if (options.compare && clicks.length > 0) {
    await browser.close();
    fail(
      '`--compare` sets the page beside another site as it loads: leave out --click, or picture the click on its own.'
    );

    return;
  }

  if (options.sheet && clicks.length === 0 && (options.frames ?? 0) <= 1) {
    await browser.close();
    fail(
      '`--sheet` lays out the pictures a --click or --frames takes: with neither, there is one picture and no sheet.'
    );

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
    const view: View = {
      width: options.width ?? 1280,
      height: options.height ?? 800,
      ...(options.scheme ? { scheme: options.scheme } : {}),
      reducedMotion: options.reducedMotion === true,
      ...(options.waitFor ? { waitFor: options.waitFor } : {}),
      ...(options.clip ? { clip: options.clip } : {}),
      ...(options.scrollTo ? { scrollTo: options.scrollTo } : {}),
      ...(options.viewport ? { viewport: true } : {}),
      // Frames are about what moves, so they are taken as the page plays.
      still:
        !options.clip && !options.scrollTo && !options.viewport && (options.frames ?? 0) <= 1 && clicks.length === 0
    };
    const how = framing(view);

    const taken = await pictureOf(browser, `${where.origin}${pathname}`, view, where.origin);
    if ('problem' in taken) {
      fail(`${taken.problem} Start the project first: npm start`);

      return;
    }

    // Named by the theme the page was painted in, which is the space's default when none was asked for.
    const name = pathname === '/' ? 'home' : pathname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
    const out = path.resolve(
      project.root,
      options.out ?? `${PROJECT_TMP}/shots/${name}-${String(view.width)}-${taken.scheme}.png`
    );
    const base = out.replace(/\.png$/, '');
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, taken.png);
    // The sections a diff is told by are the page's: a picture of part of it is one region, named for what it shows.
    const regions: PictureRegion[] = how.kind === 'page' ? await taken.page.evaluate(pageRegions, undefined) : [];
    const report: ShotReport = {
      path: pathname,
      width: view.width,
      scheme: taken.scheme,
      out,
      ...(taken.settled > 0 ? { settled: taken.settled } : {}),
      ...(taken.unloaded > 0 ? { unloaded: taken.unloaded } : {})
    };

    if (options.compare) {
      const other = new URL(options.compare);
      const target = other.pathname === '/' ? new URL(pathname, other).href : other.href;
      const compared = await compareWith(browser, taken, target, view, regions, base);
      if ('problem' in compared) {
        fail(compared.problem);

        return;
      }

      report.compare = compared;
    }

    const frames = options.frames ?? 0;
    const every = options.every ?? 500;
    let moments: Moment[] = [];
    if (clicks.length > 0) {
      const played = await clickThrough(taken, how, clicks, { frames, every });
      if ('problem' in played) {
        fail(played.problem);

        return;
      }

      moments = played.moments;
      report.clicked = played.clicked;
    } else if (frames > 1) {
      const pictures = [taken.png];
      for (let frame = 1; frame < frames; frame += 1) {
        await taken.page.waitForTimeout(every);
        pictures.push(await capture(taken.page, how));
      }

      moments = pictures.map((png, frame) => ({ label: frame === 0 ? 'before' : `+${String(frame * every)} ms`, png }));

      const diffs: PictureDiff[] = [];
      for (let frame = 1; frame < pictures.length; frame += 1) {
        diffs.push(
          await comparePictures(taken.page, dataUrl(pictures[frame - 1]), dataUrl(pictures[frame]), { regions })
        );
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

    // The pictures taken after the first: on one sheet, or each in a file of its own beside it.
    if (moments.length > 1 && options.sheet) {
      const sheet = await taken.page.evaluate(
        contactSheet,
        moments.map(moment => ({ label: moment.label, src: dataUrl(moment.png) }))
      );
      report.sheet = `${base}-sheet.png`;
      await writeFile(report.sheet, Buffer.from(sheet.replace(/^data:image\/png;base64,/, ''), 'base64'));
    } else if (moments.length > 1 && clicks.length > 0) {
      report.pictures = [];
      for (const [index, moment] of moments.slice(1).entries()) {
        const file = `${base}-${String(index + 1)}.png`;
        await writeFile(file, moment.png);
        report.pictures.push({ label: moment.label, out: file });
      }
    }

    if (options.json) {
      console.log(JSON.stringify(report));

      return;
    }

    console.log(out);
    if (report.settled) {
      console.log(
        chalk.dim(
          `${String(report.settled)} arrival${report.settled === 1 ? '' : 's'} waiting for the scroll shown as they end — --scroll-to <id> --viewport --frames 4 shows one arriving`
        )
      );
    }

    if (report.unloaded) {
      console.log(chalk.yellow(`${String(report.unloaded)} picture(s) had not loaded when the page was taken`));
    }

    if (report.compare) {
      console.log(compareText(report.compare).join('\n'));
    }

    for (const { target, changed } of report.clicked ?? []) {
      console.log(
        changed > 0
          ? `clicked ${target}: ${String(changed)}% of the picture changed`
          : chalk.yellow(`clicked ${target}: nothing changed — the click did nothing to see`)
      );
    }

    if (report.sheet) {
      console.log(`sheet: ${report.sheet}`);
    }

    for (const picture of report.pictures ?? []) {
      console.log(`${picture.label}: ${picture.out}`);
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
