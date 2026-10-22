import chalk from 'chalk';

import { openPage } from '@plitzi/sdk-authoring';

import { launchBrowser, openProjectPage } from '../browser';
import { projectHere } from './existingProject';
import { fail } from './terminal';

import type { Browser, Scheme } from '../browser';

/**
 * `plitzi page same`: whether pages draw the same on two servers of the project — the run before a task and the task's
 * copy — read, not pictured: every element on screen, its box and the styles a reader sees. A look at a task pictures
 * the pages a shared file of it reaches; velada-fidelity's design-1 waited 204 s for nine, when the task had only added
 * two tokens no other page reads. What draws the same is not pictured; what differs, or cannot be told, is.
 */

export interface SameOptions {
  /** The server the pages are read on: the task's copy. */
  url: string;
  /** …and the one they are held to: the run before it. */
  than: string;
  width?: number;
  scheme?: Scheme;
  json?: boolean;
}

/** One page, read on both: the same, or the first element that differs. */
export interface Sameness {
  path: string;
  same: boolean;
  /** The first line that differs, here → there: what tells the two apart. */
  first?: { here: string; there: string };
  problem?: string;
}

/** Every element drawn, a line each: its tag, its name, its words, its box, and what a reader sees of its style. */
const drawing = (): string[] =>
  Array.from(document.querySelectorAll('body *'))
    .filter(node => node.getClientRects().length > 0)
    .map(node => {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const words = node.childElementCount === 0 ? node.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) : '';

      return [
        node.tagName.toLowerCase(),
        node.getAttribute('data-plitzi-el') ?? '',
        words,
        [box.x, box.y + window.scrollY, box.width, box.height].map(Math.round).join(','),
        style.color,
        style.backgroundColor,
        style.backgroundImage.replace(/url\([^)]*\)/g, 'url()').slice(0, 200),
        style.fontFamily,
        style.fontSize,
        style.fontWeight,
        style.letterSpacing,
        style.borderTopWidth,
        style.borderTopColor,
        style.borderRadius,
        style.boxShadow.slice(0, 120),
        style.opacity,
        style.transform,
        // What it draws on ::before and ::after: a fill, a mark — velada's VS medal paints on one.
        ...['::before', '::after'].map(pseudo => {
          const drawn = getComputedStyle(node, pseudo);

          return drawn.content === 'none' || drawn.content === 'normal'
            ? ''
            : [drawn.content, drawn.backgroundColor, drawn.backgroundImage.slice(0, 200), drawn.opacity].join(' ');
        })
      ].join(' | ');
    });

const readOn = async (
  browser: Browser,
  origin: string,
  path: string,
  view: { width: number; scheme?: Scheme }
): Promise<string[]> => {
  const page = await openProjectPage(browser, origin, {
    width: view.width,
    height: 900,
    reducedMotion: true,
    ...(view.scheme ? { scheme: view.scheme } : {})
  });
  try {
    await openPage(page, `${origin}${path}`);
    await page.waitForSelector('[data-hydrated]', { timeout: 10_000 }).catch(() => undefined);
    await page.evaluate(() => document.fonts.ready.then(() => undefined), undefined);

    return await page.evaluate(drawing, undefined);
  } finally {
    await page.close();
  }
};

/** Each page read on both servers in one browser: the same, or where it differs. */
export const samePages = async (
  browser: Browser,
  paths: readonly string[],
  options: Pick<SameOptions, 'url' | 'than' | 'width' | 'scheme'>
): Promise<Sameness[]> => {
  const view = { width: options.width ?? 1440, ...(options.scheme ? { scheme: options.scheme } : {}) };
  const read: Sameness[] = [];
  for (const path of paths) {
    try {
      const [here, there] = await Promise.all([
        readOn(browser, new URL(options.url).origin, path, view),
        readOn(browser, new URL(options.than).origin, path, view)
      ]);
      const at = here.findIndex((line, index) => line !== there[index]);
      const differs = at !== -1 || here.length !== there.length;
      read.push({
        path,
        same: !differs,
        ...(differs
          ? {
              first: {
                here: here[at === -1 ? there.length : at] ?? '(nothing)',
                there: there[at === -1 ? here.length : at] ?? '(nothing)'
              }
            }
          : {})
      });
    } catch (error) {
      read.push({
        path,
        same: false,
        problem: error instanceof Error ? error.message.split('\n')[0] : String(error)
      });
    }
  }

  return read;
};

export const pageSame = async (paths: string[], options: SameOptions): Promise<void> => {
  const project = await projectHere('whose pages to read');
  if (!project) {
    return;
  }

  const browser = await launchBrowser(project.root);
  if ('problem' in browser) {
    fail(browser.problem);

    return;
  }

  try {
    const read = await samePages(browser, paths.length > 0 ? paths : ['/'], options);
    console.log(
      options.json
        ? JSON.stringify({ pages: read })
        : read
            .map(each =>
              each.same
                ? chalk.green(`= ${each.path}: draws the same on both`)
                : each.problem
                  ? chalk.yellow(`? ${each.path}: not told — ${each.problem}`)
                  : `≠ ${each.path}: ${each.first?.here ?? ''}\n    there: ${each.first?.there ?? ''}`
            )
            .join('\n')
    );
    if (read.some(each => !each.same)) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
};
