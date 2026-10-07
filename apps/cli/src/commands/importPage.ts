import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { darkScheme, importedFiles, importProbe } from '@plitzi/sdk-authoring';

import { sayDryRun } from './dryRun';
import { projectHere } from './existingProject';
import { filesUnder } from './filesUnder';
import { projectFormatter } from './projectFormatter';
import { siteOwnership } from './siteOwnership';
import { fail } from './terminal';
import { launchBrowser } from '../browser';

import type { DryRunOptions } from './dryRun';
import type { OwnershipOptions } from './siteOwnership';
import type { Browser, BrowserPage, Scheme } from '../browser';
import type { ImportColourSample, ImportProbe, ImportSummary } from '@plitzi/sdk-authoring';

/**
 * `plitzi page import <url>`: a page someone already has, measured in a browser and written into the project as a place to
 * start from — its tokens (colours per theme, corners, shadows, Google fonts), the outline of its blocks with their
 * layout per breakpoint, the lists it repeats as JSON rows, the pictures it shows, and a screenshot per width. Never
 * its words: the structure is what takes longest to work out by hand, and the content is the owner's.
 *
 * Only a site that is the person's: one served from this machine, or — asked of their Plitzi account, with `--account`
 * — one a verified domain of one of their spaces covers (`siteOwnership`).
 *
 *   plitzi page import http://localhost:3000/pricing --out src/pricing
 *   plitzi page import https://example.com/pricing --account
 */

export interface ImportOptions extends OwnershipOptions, DryRunOptions {
  out?: string;
  /** Validated where the flag is declared (`widths` in options.ts). */
  width?: number[];
  force?: boolean;
  json?: boolean;
}

const OUTLINE_DEPTH = 4;

/** Scrolls to the end and back, so pictures and sections that load as they come into view are there to measure. */
const revealLazyContent = async (page: BrowserPage): Promise<void> => {
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < Math.min(document.body.scrollHeight, 30_000); y += step) {
      window.scrollTo(0, y);
      await new Promise(resolve => setTimeout(resolve, 60));
    }

    window.scrollTo(0, 0);
  }, undefined);
  await page.waitForTimeout(300);
};

const measure = async (
  browser: Browser,
  url: string,
  width: number,
  scheme: Scheme,
  read: ImportColourSample[] = []
): Promise<{ probe: ImportProbe; screen: Uint8Array } | { problem: string }> => {
  const page = await browser.newPage({
    viewport: { width, height: 900 },
    colorScheme: scheme,
    reducedMotion: 'reduce'
  });
  const answered = await page.goto(url, { waitUntil: 'networkidle' }).catch((error: unknown) => error);
  if (answered instanceof Error) {
    return { problem: `${url} did not load at ${String(width)} px: ${answered.message.split('\n')[0] ?? ''}` };
  }

  await revealLazyContent(page);

  return {
    probe: await page.evaluate(importProbe, { depth: OUTLINE_DEPTH, read }),
    screen: await page.screenshot({ fullPage: true })
  };
};

const count = (amount: number, one: string, many = `${one}s`): string =>
  `${String(amount)} ${amount === 1 ? one : many}`;

const summaryText = (summary: ImportSummary, out: string, stale: string[]): string =>
  [
    chalk.green(`Imported ${summary.url} into ${out}`),
    `  tokens   ${count(summary.colours, 'colour')} (${summary.dark ? 'light and dark' : 'no dark scheme: dark repeats light'}), ${count(summary.shadows, 'shadow')}, ${count(summary.radii, 'radius', 'radii')}${summary.fonts.length > 0 ? `, fonts ${summary.fonts.join(', ')}` : ''}`,
    `  outline  ${count(summary.blocks, 'block')} at ${summary.widths.join(', ')} px`,
    ...(summary.lists.length > 0
      ? [`  lists    ${summary.lists.map(list => `${list.file} (${count(list.rows, 'row')})`).join(', ')}`]
      : []),
    `  pictures ${String(summary.pictures)} in assets.json`,
    ...(stale.length > 0
      ? [
          chalk.yellow(
            `  earlier  ${stale.join(', ')} ${stale.length === 1 ? 'was' : 'were'} there before and not written this time: delete what is stale`
          )
        ]
      : []),
    `  next     ${path.join(out, 'IMPORT.md')} says what was not carried over`
  ].join('\n');

export const importPage = async (address: string, options: ImportOptions): Promise<void> => {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    fail(`${address} is not a URL: give the whole address, https://example.com/page.`);

    return;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    fail(`${address} is not a web page: only http and https addresses are imported.`);

    return;
  }

  const project = await projectHere('to import into');
  if (!project) {
    return;
  }

  const out = options.out ?? 'src/imported';
  const target = path.resolve(project.root, out);
  if (path.relative(project.root, target).startsWith('..')) {
    fail(`${out} is outside the project: the import is written inside it.`);

    return;
  }

  const existing = await filesUnder(target);
  if (existing.length > 0 && !options.force) {
    fail(`${out} already has files: choose another --out, or --force to write over them.`);

    return;
  }

  const widths = options.width ?? [1440, 768, 390];

  const ownership = await siteOwnership(url, options);
  if (!ownership.ok) {
    if (ownership.problem) {
      fail(ownership.problem);
    }

    return;
  }

  if (options.dryRun) {
    sayDryRun(`plitzi page import ${url.href}`, [
      `${url.hostname} is yours: ${ownership.said}`,
      `measure it at ${widths.join(', ')} px, light and dark, in the project's Playwright`,
      `${existing.length > 0 ? '~' : '+'} ${out}/ — tokens.ts, outline.ts, data/*.json, assets.json, screens/, IMPORT.md`,
      ...(existing.length > 0 ? [`  over ${String(existing.length)} files an earlier import left (--force)`] : [])
    ]);

    return;
  }

  if (!options.json) {
    console.log(chalk.dim(`${url.hostname} is yours: ${ownership.said}.`));
  }

  const browser = await launchBrowser(project.root);
  if ('problem' in browser) {
    fail(browser.problem);

    return;
  }

  try {
    const measured: { probe: ImportProbe; screen: Uint8Array }[] = [];
    for (const width of widths) {
      const result = await measure(browser, url.href, width, 'light');
      if ('problem' in result) {
        fail(result.problem);

        return;
      }

      measured.push(result);
    }

    // The widest page again in the dark, reading each colour where the light one was seen.
    const widest = measured.reduce((wide, next) => (next.probe.width > wide.probe.width ? next : wide)).probe;
    const darkResult = await measure(browser, url.href, widest.width, 'dark', Object.values(widest.colors.samples));
    const dark = 'probe' in darkResult ? darkScheme(widest, darkResult.probe) : undefined;

    const { files, summary } = importedFiles({ probes: measured.map(({ probe }) => probe), ...(dark ? { dark } : {}) });
    const format = await projectFormatter(project.root);
    await mkdir(path.join(target, 'screens'), { recursive: true });
    for (const file of files) {
      const destination = path.join(target, file.path);
      await mkdir(path.dirname(destination), { recursive: true });
      const relative = path.relative(project.root, destination);
      await writeFile(destination, file.path.endsWith('.ts') ? await format(relative, file.content) : file.content);
    }

    const screens = measured.map(({ probe, screen }) => ({ path: `screens/${String(probe.width)}.png`, screen }));
    for (const { path: file, screen } of screens) {
      await writeFile(path.join(target, file), screen);
    }

    // Never deleted here: what an earlier import left may since have been edited by hand.
    const written = new Set([...files.map(file => file.path), ...screens.map(screen => screen.path)]);
    const stale = existing.filter(file => !written.has(file.split(path.sep).join('/')));
    console.log(
      options.json ? JSON.stringify({ ...summary, out, files: [...written], stale }) : summaryText(summary, out, stale)
    );
  } finally {
    await browser.close();
  }
};
