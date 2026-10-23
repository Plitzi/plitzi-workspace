import chalk from 'chalk';

import { launchBrowser } from '../browser';
import { projectHere } from './existingProject';
import { ourPage, pairOf } from './measure';
import { putIn } from './measureState';
import { originHere } from '../runs/copyServer';
import { targetOn } from './shot/capture';
import { pageAnswered } from './shot/remote';
import { fail, unanswered } from './terminal';

import type { BrowserPage, Scheme } from '../browser';

/**
 * `plitzi page outline`: what a page is made of, as the elements a visitor sees — each by a selector `page measure`
 * takes as it is, its box and its first words. The other site's with `--compare`: what to name after `=>`, read in
 * one call where agents fetched its HTML and searched it for classes (lx-controls' designer, velada-backlog's).
 */

export interface OutlineOptions {
  /** The other site, outlined instead of the project's page. */
  compare?: string;
  /** One part of the page — its element's name or any selector — outlined alone. */
  within?: string;
  width?: number;
  /** How many levels under the part are listed. */
  depth?: number;
  /** Elements clicked first, in order — an open drawer outlined: `"ours => theirs"`, each page its own side. */
  click?: string[];
  scheme?: Scheme;
  url?: string;
  json?: boolean;
}

/** One element a visitor sees: a selector that finds it, its depth under the part, its box, its own first words. */
export interface OutlinedElement {
  selector: string;
  depth: number;
  box: { x: number; y: number; width: number; height: number };
  text?: string;
  /** Of the project's page: the element's name, which `page measure` takes before any selector. */
  element?: string;
}

export interface Outline {
  url: string;
  width: number;
  elements: OutlinedElement[];
  /** Seen under the depth or past the limit: not listed — narrowed with `--within`. */
  more: number;
}

const DEPTH = 4;
const LIMIT = 120;
const WORDS = 32;

/**
 * Run in the page: its shown elements under the part asked, depth first. A selector is the element's id when one is
 * its alone, its tag and first classes when they find it alone, or else its place under the nearest ancestor that has
 * one — always one `document.querySelector` finds it by.
 */
export const outlineIn = (input: {
  within?: string;
  depth: number;
  limit: number;
  words: number;
}): { elements: OutlinedElement[]; more: number } | { problem: string } => {
  const root = input.within === undefined ? document.body : document.querySelector(input.within);
  if (root === null) {
    return { problem: `nothing on the page answers ${String(input.within)}` };
  }

  const unique = (selector: string): boolean => {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  };
  const known = new Map<Element, string>();
  const selectorOf = (node: Element): string => {
    const kept = known.get(node);
    if (kept !== undefined) {
      return kept;
    }

    const tag = node.tagName.toLowerCase();
    const named = node.getAttribute('data-plitzi-el');
    const classes = [...node.classList].filter(name => /^[A-Za-z_][\w-]*$/.test(name)).slice(0, 2);
    const own = `${tag}${classes.map(name => `.${name}`).join('')}`;
    const parent = node.parentElement;
    const place = (): string => {
      const same = parent ? [...parent.children].filter(each => each.tagName === node.tagName) : [];

      return same.length > 1 ? `${tag}:nth-of-type(${String(same.indexOf(node) + 1)})` : tag;
    };
    const chosen =
      named !== null && unique(`[data-plitzi-el="${named}"]`)
        ? `[data-plitzi-el="${named}"]`
        : // An id a theme generated (`Details-Mobile-1-template--21308694102229__product-grid`) says less than a class.
          node.id !== '' && node.id.length <= 32 && unique(`#${CSS.escape(node.id)}`)
          ? `#${CSS.escape(node.id)}`
          : unique(own)
            ? own
            : parent === null || parent === document.documentElement
              ? own
              : unique(`${selectorOf(parent)} > ${own}`)
                ? `${selectorOf(parent)} > ${own}`
                : `${selectorOf(parent)} > ${place()}`;
    known.set(node, chosen);

    return chosen;
  };
  const skipped = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'LINK', 'META', 'BR']);
  const shown = (node: Element): boolean => {
    const box = node.getBoundingClientRect();
    const style = getComputedStyle(node);

    return (
      (box.width > 0 && box.height > 0 && style.visibility === 'visible') ||
      (style.display === 'contents' && node.childElementCount > 0)
    );
  };
  const elements: OutlinedElement[] = [];
  let more = 0;
  const walk = (node: Element, depth: number): void => {
    for (const child of [...node.children]) {
      if (skipped.has(child.tagName) || !shown(child)) {
        continue;
      }

      if (depth > input.depth || elements.length >= input.limit) {
        more += 1 + child.querySelectorAll('*').length;
        continue;
      }

      const box = child.getBoundingClientRect();
      const words = [...child.childNodes]
        .filter(each => each.nodeType === Node.TEXT_NODE)
        .map(each => each.textContent ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      const named = child.getAttribute('data-plitzi-el');
      elements.push({
        selector: selectorOf(child),
        depth,
        box: {
          x: Math.round(box.left),
          y: Math.round(box.top + window.scrollY),
          width: Math.round(box.width),
          height: Math.round(box.height)
        },
        ...(words === '' ? {} : { text: words.length > input.words ? `${words.slice(0, input.words)}…` : words }),
        ...(named === null ? {} : { element: named })
      });
      // A drawing is one thing to measure, never its paths.
      if (child.tagName !== 'svg') {
        walk(child, depth + 1);
      }
    }
  };
  walk(root, 0);

  return { elements, more };
};

/** An outline in lines: indented by depth, each element's selector, box and first words. */
export const outlineText = (outline: Outline, within?: string): string[] => [
  chalk.bold(`${outline.url} at ${String(outline.width)} px${within === undefined ? '' : ` — inside ${within}`}`),
  ...outline.elements.map(
    each =>
      `${'  '.repeat(each.depth)}${each.element ?? each.selector}  ${chalk.dim(`${String(each.box.width)}×${String(each.box.height)} at ${String(each.box.x)},${String(each.box.y)}`)}${each.text === undefined ? '' : ` “${each.text}”`}`
  ),
  ...(outline.more > 0
    ? [chalk.dim(`· ${String(outline.more)} more under these, not listed — one part alone: --within <one of them>`)]
    : []),
  chalk.dim('Each is what page measure takes: plitzi page measure <path> "<ours> => <one of these>" --compare <url>')
];

export const outline = async (route: string, options: OutlineOptions): Promise<void> => {
  const project = await projectHere('whose page to outline');
  if (!project) {
    return;
  }

  const target = options.compare
    ? new URL(options.compare).pathname === '/'
      ? new URL(route, options.compare).href
      : options.compare
    : undefined;
  const plitzi = project.plitzi?.kind === 'project' ? project.plitzi : undefined;
  const where = target === undefined ? await originHere(project.root, plitzi, options.url) : undefined;
  if (where && 'problem' in where) {
    unanswered(where.problem);

    return;
  }

  const browser = await launchBrowser(project.root);
  if ('problem' in browser) {
    unanswered(browser.problem);

    return;
  }

  const width = options.width ?? 1440;
  try {
    const opened: { page: BrowserPage } | { problem: string } =
      target !== undefined
        ? await pageAnswered(browser, target, {
            width,
            height: 900,
            reducedMotion: true,
            ...(options.scheme ? { scheme: options.scheme } : {})
          })
        : await ourPage(browser, where?.origin ?? '', route, {
            width,
            ...(options.scheme ? { scheme: options.scheme } : {})
          }).then(read => (read.answered ? read : { problem: `nothing answers at ${where?.origin ?? ''}${route}` }));
    if ('problem' in opened) {
      unanswered(opened.problem);

      return;
    }

    const side = target === undefined ? 'here' : 'there';
    const clicked =
      options.click === undefined
        ? undefined
        : await putIn(opened.page, { kind: 'click', pairs: options.click.map(pairOf) }, side);
    if (clicked) {
      unanswered(clicked.problem);

      return;
    }

    // The part named as every page command names an element: its name, a tag or any selector.
    const part = options.within === undefined ? undefined : await targetOn(opened.page, options.within);
    if (part && 'problem' in part) {
      fail(part.problem);

      return;
    }

    const read = await opened.page.evaluate(outlineIn, {
      ...(part ? { within: part.selector } : {}),
      depth: options.depth ?? DEPTH,
      limit: LIMIT,
      words: WORDS
    });
    if ('problem' in read) {
      (target === undefined ? fail : unanswered)(`${read.problem} on ${target ?? `${where?.origin ?? ''}${route}`}`);

      return;
    }

    const result: Outline = { url: target ?? `${where?.origin ?? ''}${route}`, width, ...read };
    console.log(options.json ? JSON.stringify(result) : outlineText(result, options.within).join('\n'));
  } finally {
    await browser.close();
  }
};
