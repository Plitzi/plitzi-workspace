import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { darkScheme, importedFiles, importProbe } from '@plitzi/sdk-authoring';

import { findProject } from './existingProject';
import { projectFormatter } from './projectFormatter';
import { robotsAllows } from './robots';
import { launchBrowser } from '../browser';

import type { Browser, BrowserPage, Scheme } from '../browser';
import type { ImportColourSample, ImportProbe, ImportSummary } from '@plitzi/sdk-authoring';

/**
 * `plitzi import <url>`: a page someone already has, measured in a browser and written into the project as a place to
 * start from — its tokens (colours per theme, corners, shadows, Google fonts), the outline of its blocks with their
 * layout per breakpoint, the lists it repeats as JSON rows, the pictures it shows, and a screenshot per width. Never
 * its words: the structure is what takes longest to work out by hand, and the content is the owner's.
 *
 * It asks the site's `robots.txt` first, and stops where that says no.
 *
 *   plitzi import https://example.com/pricing --out src/pricing
 */

export interface ImportOptions {
  out?: string;
  widths?: string;
  force?: boolean;
  json?: boolean;
}

/** The name `robots.txt` is read for. A site that names it says what it may read; one that does not, `*` does. */
const AGENT = 'Plitzi-Import';

const OUTLINE_DEPTH = 4;

const robotsVerdict = async (url: URL): Promise<{ allowed: true } | { allowed: false; problem: string }> => {
  let text: string;
  try {
    const response = await fetch(new URL('/robots.txt', url), { signal: AbortSignal.timeout(5000) });
    // No robots.txt (404) asks nothing; one the server will not give (5xx) is read as asking nothing too, as crawlers do.
    if (!response.ok) {
      return { allowed: true };
    }

    text = await response.text();
  } catch {
    return { allowed: true };
  }

  return robotsAllows(text, `${url.pathname}${url.search}`, AGENT)
    ? { allowed: true }
    : {
        allowed: false,
        problem: `${url.origin}/robots.txt asks agents not to read ${url.pathname}. If the site is yours, allow ${AGENT} there.`
      };
};

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

/** Every file under a folder, by its path inside it — none when there is no such folder. */
const filesUnder = async (folder: string): Promise<string[]> => {
  const entries = await readdir(folder, { recursive: true, withFileTypes: true }).catch(() => []);

  return entries
    .filter(entry => entry.isFile())
    .map(entry => path.relative(folder, path.join(entry.parentPath, entry.name)));
};

const count = (amount: number, one: string, many = `${one}s`): string =>
  `${String(amount)} ${amount === 1 ? one : many}`;

const summaryText = (summary: ImportSummary, out: string, stale: string[]): string =>
  [
    chalk.green(`✓ Imported ${summary.url} into ${out}`),
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
  const fail = (problem: string): void => {
    console.error(chalk.red(problem));
    process.exitCode = 1;
  };

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

  const project = await findProject(process.cwd());
  if (!project) {
    fail('There is no package.json here or above: run this in the project to import into.');

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

  const widths = (options.widths ?? '1440,768,390')
    .split(',')
    .map(Number)
    .filter(width => Number.isInteger(width) && width >= 320 && width <= 3840);
  if (widths.length === 0) {
    fail('--widths takes widths in pixels between 320 and 3840, separated by commas: 1440,768,390.');

    return;
  }

  const robots = await robotsVerdict(url);
  if (!robots.allowed) {
    fail(robots.problem);

    return;
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
