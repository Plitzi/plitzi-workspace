import chalk from 'chalk';

import { openPage } from '@plitzi/sdk-authoring';

import { launchBrowser, openProjectPage, PROJECT_QUIET_MS } from '../browser';
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
  /** Elements left out — a task's own parts, which it changed: that nothing else moved is what is read. */
  except?: string[];
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
export const drawing = (except: readonly string[] = []): string[] => {
  const left = except.map(id => `[data-plitzi-el="${id}"]`);
  const inPart = (node: Element): boolean => left.some(selector => node.closest(selector) !== null);
  const holdsPart = (node: Element): boolean => left.some(selector => node.querySelector(selector) !== null);
  // Where it is, from its parent's top: a part that grew moves what follows it down the page, never within its own
  // parent — save under the parent that holds the part, where only its size is read.
  const placed = (node: Element, box: DOMRect): string => {
    const parent = node.parentElement;
    const size = [box.width, box.height].map(Math.round).join('x');
    if (!parent || holdsPart(parent)) {
      return `${String(Math.round(box.x))},·,${size}`;
    }

    const from = parent.getBoundingClientRect();

    return `${String(Math.round(box.x - from.x))},${String(Math.round(box.y - from.y))},${size}`;
  };

  return Array.from(document.querySelectorAll('body *'))
    .filter(node => node.getClientRects().length > 0 && !inPart(node))
    .map(node => {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      // A local address is the same on both servers whatever port each was served on: /overlay writes its own URL, and
      // read "moved" on every look at a task (velada-shell's design-1).
      const words =
        node.childElementCount === 0
          ? node.textContent
              .replace(/\s+/g, ' ')
              .replace(/\b(127\.0\.0\.1|localhost|\[::1\]):\d+/g, '$1:<port>')
              .trim()
              .slice(0, 80)
          : '';

      return [
        node.tagName.toLowerCase(),
        node.getAttribute('data-plitzi-el') ?? '',
        words,
        // What holds a part left out grows with it: its box is not read, its style still is.
        holdsPart(node) ? '' : placed(node, box),
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
};

const readOn = async (
  browser: Browser,
  origin: string,
  path: string,
  view: { width: number; scheme?: Scheme; except: readonly string[] }
): Promise<string[]> => {
  const page = await openProjectPage(browser, origin, {
    width: view.width,
    height: 900,
    reducedMotion: true,
    ...(view.scheme ? { scheme: view.scheme } : {})
  });
  try {
    await openPage(page, `${origin}${path}`, { quietMs: PROJECT_QUIET_MS });
    await page.waitForSelector('[data-hydrated]', { timeout: 10_000 }).catch(() => undefined);
    await page.evaluate(() => document.fonts.ready.then(() => undefined), undefined);

    return await page.evaluate(drawing, view.except);
  } finally {
    await page.close();
  }
};

/** The first line two drawings differ by — one longer than the other differs where the shorter ends — or none. */
export const firstDifference = (
  here: readonly string[],
  there: readonly string[]
): { here: string; there: string } | undefined => {
  const at = here.findIndex((line, index) => line !== there[index]);
  if (at === -1 && here.length === there.length) {
    return undefined;
  }

  const index = at === -1 ? Math.min(here.length, there.length) : at;

  return { here: here[index] ?? '(nothing)', there: there[index] ?? '(nothing)' };
};

/** Each page read on both servers in one browser: the same, or where it differs. */
export const samePages = async (
  browser: Browser,
  paths: readonly string[],
  options: Pick<SameOptions, 'url' | 'than' | 'width' | 'scheme' | 'except'>
): Promise<Sameness[]> => {
  const view = {
    width: options.width ?? 1440,
    except: options.except ?? [],
    ...(options.scheme ? { scheme: options.scheme } : {})
  };
  const read: Sameness[] = [];
  for (const path of paths) {
    try {
      const [here, there] = await Promise.all([
        readOn(browser, new URL(options.url).origin, path, view),
        readOn(browser, new URL(options.than).origin, path, view)
      ]);
      const first = firstDifference(here, there);
      read.push({ path, same: first === undefined, ...(first ? { first } : {}) });
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
