import chalk from 'chalk';

import { pairOf } from './measure';
import { putIn } from './measureState';
import { targetOn } from './shot/capture';
import { otherPageAt, pageAnswered } from './shot/remote';
import { actingSteps, playedOn } from './shot/steps';
import { openVisit, visitorBrowser, visitViewOf } from './visit';
import { VIEW_HEIGHT } from '../../browser';
import { keptOutline } from '../../browser/keptBrowser';
import { originHere } from '../../runs/copies/copyServer';
import { projectHere } from '../project/existingProject';
import { fail, unanswered } from '../shared/terminal';

import type { BrowserPage, Scheme } from '../../browser';
import type { VisitorOptions } from '../register/options';

/**
 * `plitzi page outline`: what a page is made of, as the elements a visitor sees — each by a selector `page measure`
 * takes as it is, its box and its first words. The other site's with `--compare`: what to name after `=>`, read in
 * one call where agents fetched its HTML and searched it for classes (a run's designer).
 */

export interface OutlineOptions extends VisitorOptions {
  /** The other site, outlined instead of the project's page. */
  compare?: string;
  /** One part of the page — its element's name or any selector — outlined alone. */
  within?: string;
  /** The viewport widths, an outline each. */
  width?: number[];
  /** How many levels under the part are listed. */
  depth?: number;
  /** Elements clicked first, in order — an open drawer outlined: `"ours => theirs"`, each page its own side. */
  click?: string[];
  /** Played on the project's page before it is outlined, as `page play` writes them: what only a visitor's steps open. */
  steps?: string;
  scheme?: Scheme;
  /**
   * The elements whose name, selector or words hold this — the whole page searched, at any depth: a run's designer
   * found the sign-in wordmark's id, built from a prefix in code, by grepping the source.
   */
  find?: string;
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
  /**
   * Hidden for screen readers alone — the `sr-only` pattern — and listed so, never as seen: a spike took a stack's
   * "1 listening" for a second count on screen.
   */
  screenReaderOnly?: true;
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
/** How deep, and how many, a `--find` reads: the whole page, its matches alone listed. */
const FIND_DEPTH = 64;
const FIND_LIMIT = 5000;

/** The elements whose name, selector or words hold `word`, each at the top: what `--find` lists. */
export const foundIn = (elements: readonly OutlinedElement[], word: string): OutlinedElement[] => {
  const asked = word.toLowerCase();

  return elements
    .filter(each => [each.element, each.selector, each.text].some(said => said?.toLowerCase().includes(asked)))
    .map(each => ({ ...each, depth: 0 }));
};
const WORDS = 32;

/** The mark the part asked for (`--within`) carries while it is outlined: found by the browser, read by the page. */
const OUTLINE_ROOT = 'data-plitzi-outline-root';

/**
 * Run in the page: its shown elements under the part asked, depth first. A selector is the element's id when one is
 * its alone, its tag and first classes when they find it alone, or else its place under the nearest ancestor that has
 * one — always one `document.querySelector` finds it by.
 */
export const outlineIn = (input: {
  within?: string;
  /**
   * The attribute marking what was shown before a click: listed are only the elements it opened — each opened part from
   * depth 0 — and the rest walked through unlisted (the open menu came cut by --depth under the whole page).
   */
  opened?: string;
  depth: number;
  limit: number;
  words: number;
}): { elements: OutlinedElement[]; more: number } | { problem: string } => {
  const matches = (selector: string): Element[] => {
    try {
      return [...document.querySelectorAll(selector)];
    } catch {
      return [];
    }
  };
  // The part a visitor sees: a page that draws one per width hides the other, and its first was a hidden copy with no
  // rows to list (a run's requests list, outlined empty).
  const visibleBox = (node: Element): boolean => {
    const box = node.getBoundingClientRect();

    return box.width > 0 && box.height > 0;
  };
  const found = input.within === undefined ? [] : matches(input.within);
  const root = input.within === undefined ? document.body : (found.find(visibleBox) ?? found.at(0) ?? null);
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
        : // A long id is most often one a theme or a framework generated, and says less than a class.
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
  // The `sr-only` pattern: clipped all over, or a box of a pixel that clips what overflows it.
  const forScreenReaders = (node: Element): boolean => {
    const style = getComputedStyle(node);
    const box = node.getBoundingClientRect();

    return (
      /inset\(\s*50%/.test(style.clipPath) ||
      /^rect\(0(px)?,?\s*0(px)?,?\s*0(px)?,?\s*0(px)?\)$/.test(style.clip) ||
      (box.width <= 1 && box.height <= 1 && /hidden|clip/.test(`${style.overflowX} ${style.overflowY}`))
    );
  };
  const elements: OutlinedElement[] = [];
  let more = 0;
  const walk = (node: Element, depth: number): void => {
    for (const child of [...node.children]) {
      if (skipped.has(child.tagName) || !shown(child)) {
        continue;
      }

      // Shown before the click: not what it opened — what it opened may be inside it.
      if (input.opened !== undefined && child.hasAttribute(input.opened)) {
        walk(child, depth);
        continue;
      }

      // A bare wrapper — a div or span that names nothing, says nothing and holds one thing — is walked through: a page's
      // first levels were five such divs and "480 more under these", none of its parts named.
      const shownChildren = [...child.children].filter(each => !skipped.has(each.tagName) && shown(each));
      const ownWords = [...child.childNodes].some(
        each => each.nodeType === Node.TEXT_NODE && (each.textContent ?? '').trim() !== ''
      );
      const bare = ['DIV', 'SPAN'].includes(child.tagName) && !child.hasAttribute('data-plitzi-el') && child.id === '';
      if (bare && !ownWords && shownChildren.length === 1) {
        walk(child, depth);
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
      const screenReaderOnly = forScreenReaders(child);
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
        ...(named === null ? {} : { element: named }),
        ...(screenReaderOnly ? { screenReaderOnly: true as const } : {})
      });
      // A drawing is one thing to measure, never its paths; what is inside a part for screen readers is theirs too.
      if (child.tagName !== 'svg' && !screenReaderOnly) {
        walk(child, depth + 1);
      }
    }
  };
  walk(root, 0);

  return { elements, more };
};

/** The attribute marking what a page showed before a click, removed with the page. */
const OPENED_MARK = 'data-plitzi-outline-before';

/** Run in the page: every element shown now, marked — what a click shows next is what lacks the mark. */
export const markShown = (mark: string): void => {
  for (const node of document.querySelectorAll('body *')) {
    const box = node.getBoundingClientRect();
    if (box.width > 0 && box.height > 0 && getComputedStyle(node).visibility === 'visible') {
      node.setAttribute(mark, '');
    }
  }
};

/** An outline in lines: indented by depth, each element's selector, box and first words. */
export const outlineText = (outline: Outline, within?: string, opened = false): string[] => [
  chalk.bold(
    `${outline.url} at ${String(outline.width)} px${opened ? ' — what the click opened' : within === undefined ? '' : ` — inside ${within}`}`
  ),
  ...(opened && outline.elements.length === 0 ? [chalk.yellow('  nothing new is shown after the click')] : []),
  ...outline.elements.map(
    each =>
      `${'  '.repeat(each.depth)}${each.element ?? each.selector}  ${chalk.dim(`${String(each.box.width)}×${String(each.box.height)} at ${String(each.box.x)},${String(each.box.y)}`)}${each.text === undefined ? '' : ` “${each.text}”`}${each.screenReaderOnly ? chalk.yellow('  for screen readers only, not seen') : ''}`
  ),
  ...(outline.more > 0
    ? [chalk.dim(`· ${String(outline.more)} more under these, not listed — one part alone: --within <one of them>`)]
    : []),
  chalk.dim('Each is what page measure takes: plitzi page measure <path> "<ours> => <one of these>" --compare <url>')
];

/**
 * A page outlined as it is open: its elements clicked first — what they opened listed alone, unless a part is named —
 * then the part named, or the whole page. What `page outline` does on a page of its own and the kept browser does on a
 * warm one (`keeperRoutes.ts`); `phase` says what failed: a click, the part, or the reading.
 */
export const outlineOnPage = async (
  page: BrowserPage,
  asked: { clicks?: readonly string[]; within?: string; depth: number; limit: number; words: number }
): Promise<
  { outline: Omit<Outline, 'url' | 'width'>; opened: boolean } | { problem: string; phase: 'click' | 'part' | 'read' }
> => {
  // What shows before the click is marked, so that what it opens is listed alone — unless a part is named.
  const before = asked.clicks !== undefined && asked.within === undefined ? OPENED_MARK : undefined;
  if (before !== undefined) {
    await page.evaluate(markShown, before);
  }

  const clicked =
    asked.clicks === undefined
      ? undefined
      : await putIn(page, { kind: 'click', pairs: asked.clicks.map(each => ({ here: each, there: each })) }, 'here');
  if (clicked) {
    return { ...clicked, phase: 'click' };
  }

  // The part named as every page command names an element — its name, a tag or any selector, Playwright's too — found
  // by the browser and marked for the page to read: a selector `>> nth=0` that page measure took answered "nothing on
  // the page" here, read by the page's own querySelectorAll (a run's designer).
  const part = asked.within === undefined ? undefined : await targetOn(page, asked.within);
  if (part && 'problem' in part) {
    return { ...part, phase: 'part' };
  }

  if (part?.found === true) {
    await page
      .locator(part.selector)
      .filter({ visible: true })
      .first()
      .evaluate((node, mark: string) => {
        node.setAttribute(mark, '');
      }, OUTLINE_ROOT);
  }

  try {
    const read = await page.evaluate(outlineIn, {
      ...(part ? { within: part.found ? `[${OUTLINE_ROOT}]` : part.selector } : {}),
      ...(before === undefined ? {} : { opened: before }),
      depth: asked.depth,
      limit: asked.limit,
      words: asked.words
    });

    return 'problem' in read
      ? { problem: read.problem.replace(`[${OUTLINE_ROOT}]`, asked.within ?? ''), phase: 'read' }
      : { outline: read, opened: before !== undefined };
  } finally {
    await page.evaluate((mark: string) => {
      document.querySelector(`[${mark}]`)?.removeAttribute(mark);
    }, OUTLINE_ROOT);
  }
};

export const outline = async (route: string, options: OutlineOptions): Promise<void> => {
  const project = await projectHere('whose page to outline');
  if (!project) {
    return;
  }

  const target = options.compare === undefined ? undefined : otherPageAt(route, options.compare);
  const plitzi = project.plitzi?.kind === 'project' ? project.plitzi : undefined;
  const where = target === undefined ? await originHere(project.root, plitzi, options.url) : undefined;
  if (where && 'problem' in where) {
    unanswered(where.problem);

    return;
  }

  const steps = actingSteps(options.steps, 'page outline', { others: false });
  if ('problem' in steps) {
    fail(`${steps.problem}.`);

    return;
  }

  // A visitor's steps make what they make on the project's page: the other site has no such data to make.
  if (steps.length > 0 && target !== undefined) {
    fail('--steps plays on the project’s page: leave out --compare, or open the other site’s with --click.');

    return;
  }

  // Each width its own outline, as `check` and `measure` take a list: a run's agents asked for 390,1440 four times.
  const widths = options.width ?? [1440];
  const outlines: Outline[] = [];
  const at = async (width: number): Promise<void> => {
    const url = target ?? `${where?.origin ?? ''}${route}`;
    const asked = {
      ...(options.click
        ? { clicks: options.click.map(each => pairOf(each)[target === undefined ? 'here' : 'there']) }
        : {}),
      ...(options.within === undefined ? {} : { within: options.within }),
      depth: options.find === undefined ? (options.depth ?? DEPTH) : FIND_DEPTH,
      limit: options.find === undefined ? LIMIT : FIND_LIMIT,
      words: WORDS
    };
    const said = (
      read: { outline: Omit<Outline, 'url' | 'width'>; opened: boolean } | { problem: string; phase: string }
    ): void => {
      if ('problem' in read) {
        // A part or a reading this page refuses is the asker's; the other site not answering a click is the site's.
        (read.phase === 'part' || (read.phase === 'read' && target === undefined) ? fail : unanswered)(
          read.phase === 'read' ? `${read.problem} on ${url}` : read.problem
        );

        return;
      }

      const result: Outline =
        options.find === undefined
          ? { url, width, ...read.outline }
          : { url, width, elements: foundIn(read.outline.elements, options.find), more: 0 };
      if (options.find !== undefined && result.elements.length === 0 && !options.json) {
        console.log(`Nothing on ${url} at ${String(width)} px is named or says "${options.find}".`);

        return;
      }

      if (options.json) {
        outlines.push(result);

        return;
      }

      console.log(outlineText(result, read.opened ? undefined : options.within, read.opened).join('\n'));
    };

    // The other site outlined warm in the kept browser, on a page of its own: launched and loaded cold, 15 s a call
    // (a run's dev-2, 28 calls). Not answered there, it is read here as before.
    if (target !== undefined) {
      const kept = await keptOutline(project.root, {
        url: target,
        width,
        height: options.height ?? VIEW_HEIGHT,
        reducedMotion: true,
        ...(options.scheme ? { scheme: options.scheme } : {}),
        ...asked
      });
      if (kept && 'outline' in kept) {
        said({ outline: kept.outline, opened: asked.clicks !== undefined && asked.within === undefined });

        return;
      }
    }

    const ready = await visitorBrowser(project.root, options);
    if (!ready) {
      return;
    }

    const { visitor, browser } = ready;

    try {
      const opened: { page: BrowserPage } | { problem: string } =
        target !== undefined
          ? await pageAnswered(browser, target, {
              width,
              height: options.height ?? VIEW_HEIGHT,
              reducedMotion: true,
              ...(options.scheme ? { scheme: options.scheme } : {})
            })
          : await openVisit(browser, where?.origin ?? '', route, {
              width,
              ...visitViewOf(options),
              ...visitor,
              ...(options.scheme ? { scheme: options.scheme } : {})
            }).then(read => (read.answered ? read : { problem: read.problem ?? `nothing answers at ${url}` }));
      if ('problem' in opened) {
        unanswered(opened.problem);

        return;
      }

      const notPlayed = await playedOn(opened.page, steps);
      if (notPlayed) {
        fail(`--steps: ${notPlayed.problem}.`);

        return;
      }

      said(await outlineOnPage(opened.page, asked));
    } finally {
      await browser.close();
    }
  };
  for (const width of widths) {
    await at(width);
  }

  if (options.json) {
    console.log(JSON.stringify(widths.length === 1 ? outlines[0] : outlines));
  }
};
