import { readFile, writeFile } from 'node:fs/promises';

import chalk from 'chalk';

import {
  compareDecorations,
  comparePictures,
  compareTexts,
  PAGE_DECORATION_LIMIT,
  PAGE_TEXT_LIMIT,
  pageDecorations,
  pageTexts
} from '@plitzi/sdk-authoring';

import { pictureOf, readPage } from './capture';
import { pictureAnswered } from './remote';
import { DRIFT_PX, TEXTS_SHOWN } from './types';
import { dataUrl, fromDataUrl } from '../../browser';

import type { CompareReport, RegionChange, Taken, View } from './types';
import type { Browser } from '../../browser';
import type { KeptPage } from '../../runs/reference';
import type {
  DecorationKind,
  PictureDiff,
  PictureRegion,
  SectionDecorations,
  TextDifference
} from '@plitzi/sdk-authoring';

/**
 * What moves between frames, and what differs from another site — by region and by text, measured — and a sheet
 * of frames.
 */

const shiftText = (shift: number | undefined): string =>
  shift !== undefined && Math.abs(shift) > DRIFT_PX ? ` (${shift > 0 ? '+' : ''}${String(shift)}px there)` : '';

export const regionsText = (regions: RegionChange[]): string =>
  regions.map(region => `${region.name} ${String(region.changed)}%${shiftText(region.shift)}`).join(', ');

/** Compared frame to frame: the most each region changed between two that follow each other. */
export const framesMoved = (diffs: PictureDiff[]): RegionChange[] => {
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

const countsText = (counts: Partial<Record<DecorationKind, number>>): string => {
  const said = Object.entries(counts).map(([kind, count]) => `${String(count)} ${kind}${count === 1 ? '' : 's'}`);

  return said.length > 0 ? said.join(', ') : 'none';
};

/**
 * A section's dress, in one line: how many layers of each kind on either page, and the looks it has none of — what
 * `--dress` fails on. The layers there are more of, or here only, are in `--json` (`missing`, `extra`): listed here
 * they named looks the page already had, drawn another way, and read as what to add (velada-dress).
 */
const decorationText = (section: SectionDecorations): string =>
  `  ${section.section}: ${countsText(section.here)} → ${countsText(section.there)}${section.absent.length > 0 ? ` — none here of: ${section.absent.join('; ')}` : ''}`;

/** What a comparison found, in the lines an agent reads before it opens a picture. */
export const compareText = (compare: CompareReport): string[] => {
  const lines = [
    compare.section === undefined
      ? `${chalk.bold(`${String(compare.changed)}% differs`)} from ${compare.url}${compare.regions.length > 0 ? ` — ${regionsText(compare.regions)}` : ''}`
      : `${chalk.bold(regionsText(compare.regions))} differs from ${compare.url} (the whole page ${String(compare.changed)}%; its dress and texts below are its own)`,
    ...(compare.keptAt
      ? [
          chalk.dim(
            `  as the run kept it at ${compare.keptAt.slice(0, 16).replace('T', ' ')} UTC (plitzi run reference) — --live measures the site as it is now`
          )
        ]
      : [])
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

  // Before the words: a glow, a gradient or an ornament lost is what a visitor sees first, and the words never say it.
  if (compare.decorations.length > 0) {
    lines.push(
      'dress (gradients, glows, ornaments, background images), by section — layers here → there, and the looks there none here has (what --dress fails on; --json lists every layer):',
      ...compare.decorations.map(decorationText)
    );
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

/** How much of the page around a clipped section its pictures keep, above and below: where it starts and ends shows. */
const CLIP_MARGIN = 40;

/**
 * The comparison's pictures cut to one section: ours where it is, theirs where the alignment found it — what a `--clip`
 * asks of a comparison. They were the whole page, 12,000 px tall, and every designer cropped them by hand (velada-dress).
 */
export const cropToSection = async (
  page: Taken['page'],
  files: { sideBySide: string; diff: string },
  box: { y: number; height: number },
  shift: number
): Promise<void> => {
  const read = async (file: string): Promise<string> =>
    `data:image/png;base64,${(await readFile(file)).toString('base64')}`;
  const cut = await page.evaluate(
    async ({ pair, diff, top, height, theirs }) => {
      const load = (source: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error('a picture of the comparison did not load'));
          image.src = source;
        });
      const [whole, marked] = await Promise.all([load(pair), load(diff)]);
      const width = whole.width / 2;
      const canvas = (w: number): [HTMLCanvasElement, CanvasRenderingContext2D] => {
        const made = document.createElement('canvas');
        made.width = w;
        made.height = height;
        const context = made.getContext('2d');
        if (!context) {
          throw new Error('no 2D canvas in this page');
        }

        return [made, context];
      };
      const [both, bothContext] = canvas(width * 2);
      bothContext.drawImage(whole, 0, top, width, height, 0, 0, width, height);
      bothContext.drawImage(whole, width, Math.max(0, top + theirs), width, height, width, 0, width, height);
      const [only, onlyContext] = canvas(marked.width);
      onlyContext.drawImage(marked, 0, top, marked.width, height, 0, 0, marked.width, height);

      return { pair: both.toDataURL('image/png'), diff: only.toDataURL('image/png') };
    },
    {
      pair: await read(files.sideBySide),
      diff: await read(files.diff),
      top: Math.max(0, Math.round(box.y) - CLIP_MARGIN),
      height: Math.round(box.height) + CLIP_MARGIN * 2,
      theirs: Math.round(shift)
    }
  );
  await writeFile(files.sideBySide, fromDataUrl(cut.pair));
  await writeFile(files.diff, fromDataUrl(cut.diff));
};

/** The other site beside this page: section by section where each one is, and the words both have, measured. */
export const compareWith = async (
  browser: Browser,
  taken: Taken,
  target: string,
  view: View,
  regions: PictureRegion[],
  base: string,
  /** The page as the run kept it: measured against, rather than the site asked now. */
  kept?: { png: Uint8Array; page: KeptPage }
): Promise<CompareReport | { problem: string }> => {
  // Their page in the theme ours was painted in: two schemes are not a difference worth reporting. One served on this
  // machine is the project's own — the run before a task (`task look --before`) — and is opened as the project is, its
  // theme chosen as a visitor's toggle chooses it: asked as another site's, it painted its default (dark) against a
  // light page, and differed 90%.
  const local = /^(127\.0\.0\.1|localhost|\[::1\])$/.test(new URL(target).hostname);
  // Another site is asked as the reference keeps it: again, later, when it says it is busy (429, 503) — velada-dress's
  // original rate-limited a headless browser asked often (Cloudflare 1015), and a comparison failed on its error page.
  const live = kept
    ? undefined
    : local
      ? await pictureOf(browser, target, { ...view, scheme: taken.scheme }, new URL(target).origin)
      : await pictureAnswered(browser, target, { ...view, scheme: taken.scheme });
  if (live && 'problem' in live) {
    return live;
  }

  const theirs = kept
    ? {
        png: kept.png,
        texts: kept.page.texts,
        unloaded: kept.page.unloaded,
        decorations: kept.page.decorations
      }
    : live
      ? {
          png: live.png,
          texts: await readPage(live.page, pageTexts, PAGE_TEXT_LIMIT),
          unloaded: live.unloaded,
          decorations: await readPage(live.page, pageDecorations, PAGE_DECORATION_LIMIT)
        }
      : undefined;
  if (!theirs) {
    return { problem: `${target} was neither kept nor asked` };
  }

  const diff = await comparePictures(taken.page, dataUrl(taken.png), dataUrl(theirs.png), { regions, align: true });
  await writeFile(`${base}-compare.png`, fromDataUrl(diff.sideBySide));
  await writeFile(`${base}-diff.png`, fromDataUrl(diff.diff));
  const rowShift = diff.rowShift ?? [];
  const shiftAt = (y: number): number => rowShift[Math.min(Math.max(0, Math.round(y)), rowShift.length - 1)] ?? 0;
  const texts = compareTexts(await readPage(taken.page, pageTexts, PAGE_TEXT_LIMIT), theirs.texts, shiftAt);
  // Their dress placed in our sections, each where the pictures found it there: a site that names its sections otherwise
  // (la-velada's original names none) is still read section by section.
  const shifted = regions.map(region => ({
    ...region,
    y: region.y + (diff.regions.find(change => change.name === region.name)?.shift ?? 0)
  }));
  const decorations = compareDecorations(
    { layers: await readPage(taken.page, pageDecorations, PAGE_DECORATION_LIMIT), regions },
    { layers: theirs.decorations, regions: shifted }
  );

  return {
    url: target,
    ...(kept ? { keptAt: kept.page.at } : {}),
    changed: diff.changed,
    heights: { here: diff.heights.a, there: diff.heights.b },
    ...(diff.driftFrom ? { driftFrom: diff.driftFrom } : {}),
    regions: diff.regions,
    texts,
    decorations,
    unloaded: theirs.unloaded,
    sideBySide: `${base}-compare.png`,
    diff: `${base}-diff.png`
  };
};

/**
 * The pictures on one sheet, each under what it shows, four to a row and each 360 px wide: runs in the page, so it is
 * self-contained — no import, nothing it closes over.
 */
export function contactSheet(cells: { label: string; src: string }[]): Promise<string> {
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
 * Each look a section has none of where the other page dresses it so — a light across it, a glow, its ornaments: what
 * `--dress` fails on. Counts differ between two ways of drawing one look (corner brackets as gradients here, a frame
 * there); a sort and a span wholly absent is what a visitor sees missing.
 */
export const missingDress = (decorations: readonly SectionDecorations[]): string[] =>
  decorations.flatMap(section => section.absent.map(look => `${section.section} lacks ${look}`));
