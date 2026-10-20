import { writeFile } from 'node:fs/promises';

import chalk from 'chalk';

import { comparePictures, compareTexts, PAGE_TEXT_LIMIT, pageTexts } from '@plitzi/sdk-authoring';

import { pictureOf } from './capture';
import { DRIFT_PX, TEXTS_SHOWN } from './types';
import { dataUrl, fromDataUrl } from '../../browser';

import type { CompareReport, RegionChange, Taken, View } from './types';
import type { Browser } from '../../browser';
import type { PictureDiff, PictureRegion, TextDifference } from '@plitzi/sdk-authoring';

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

/** What a comparison found, in the lines an agent reads before it opens a picture. */
export const compareText = (compare: CompareReport): string[] => {
  const lines = [
    compare.section === undefined
      ? `${chalk.bold(`${String(compare.changed)}% differs`)} from ${compare.url}${compare.regions.length > 0 ? ` — ${regionsText(compare.regions)}` : ''}`
      : `${chalk.bold(regionsText(compare.regions))} differs from ${compare.url} (the whole page ${String(compare.changed)}%; the rest below is the whole page’s)`
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
export const compareWith = async (
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
