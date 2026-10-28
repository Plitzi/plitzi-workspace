import { openVisit, visitorAsked } from './visit';
import { launchBrowser } from '../../browser';

import type { Visitor, VisitView } from './visit';
import type { Browser, Scheme } from '../../browser';

/**
 * Whether pages draw the same on two servers of the project — the run before a task and the task's copy — read, not
 * pictured: every element on screen, its box and the styles a reader sees. A look at a task pictures the pages a shared
 * file of it reaches; a run's designer waited 204 s for nine, when the task had only added two tokens no other page
 * reads. What draws the same is not pictured; what differs, or cannot be told, is. `task look` reads it.
 */

export interface SameAsk {
  /** The server the pages are read on: the task's copy. */
  url: string;
  /** …and the one they are held to: the run before it. */
  compare: string;
  width?: number;
  scheme?: Scheme;
  /** Elements left out — a task's own parts, which it changed: that nothing else moved is what is read. */
  except?: readonly string[];
}

/** One page, read on both: the same, or the first element that differs. */
export interface Sameness {
  path: string;
  same: boolean;
  /** The first element that differs, here and there: what tells the two apart, field by field. */
  first?: Difference;
  problem?: string;
}

/** One element as a drawing reads it: its tag, its name, its words, its box and what a reader sees of its style. */
export type DrawnElement = Record<string, string>;

/**
 * The first element two drawings differ by — by its name (its tag when it has none) — and each field it differs in,
 * here and there; or one drawn on one side alone. Read field by field: a look said an element "moved" by printing two
 * lines of twenty fields joined by bars, the one that differed left to find (a run's tester).
 */
export interface Difference {
  element: string;
  changed: { field: string; here: string; there: string }[];
  /** Drawn on one side alone: the other has no element where it stands. */
  only?: 'here' | 'there';
  /** Nothing but its words differ: what the page says — a time, a count — not how it is drawn. */
  wordsOnly?: true;
  /**
   * The innermost element inside it that differs too: what grew, where the first is what holds it — a look named only
   * `explore-body 763→780`, and its tester could not tell data from the task.
   */
  inside?: Difference;
}

/** A difference in words, before → now: what a person and an agent read of it. */
export const differenceText = ({ element, changed, only, inside }: Difference): string =>
  only === 'here'
    ? `${element} is drawn here, and not before`
    : only === 'there'
      ? `${element} was drawn before, and is not here`
      : `${element}: ${changed.map(each => `${each.field} ${each.there || '—'} → ${each.here || '—'}`).join('; ')}${inside ? ` — inside it, ${differenceText(inside)}` : ''}`;

/** Every element drawn, a record each: its tag, its name, its words, its box, and what a reader sees of its style. */
export const drawing = (except: readonly string[] = []): Record<string, string>[] => {
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
      // read "moved" on every look at a task (a run's design-1).
      const words =
        node.childElementCount === 0
          ? node.textContent
              .replace(/\s+/g, ' ')
              .replace(/\b(127\.0\.0\.1|localhost|\[::1\]):\d+/g, '$1:<port>')
              .trim()
              .slice(0, 80)
          : '';

      // What it draws on ::before and ::after: a fill, a mark — a run's VS medal paints on one.
      const pseudo = (which: string): string => {
        const drawn = getComputedStyle(node, which);

        return drawn.content === 'none' || drawn.content === 'normal'
          ? ''
          : [drawn.content, drawn.backgroundColor, drawn.backgroundImage.slice(0, 200), drawn.opacity].join(' ');
      };

      let depth = 0;
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        depth += 1;
      }

      return {
        tag: node.tagName.toLowerCase(),
        name: node.getAttribute('data-plitzi-el') ?? '',
        // How deep it is: what is inside an element that differs, read for what in it differs too (`Difference.inside`).
        depth: String(depth),
        words,
        // What holds a part left out grows with it: its box is not read, its style still is.
        box: holdsPart(node) ? '' : placed(node, box),
        color: style.color,
        'background-color': style.backgroundColor,
        'background-image': style.backgroundImage.replace(/url\([^)]*\)/g, 'url()').slice(0, 200),
        'font-family': style.fontFamily,
        'font-size': style.fontSize,
        'font-weight': style.fontWeight,
        'letter-spacing': style.letterSpacing,
        'border-top-width': style.borderTopWidth,
        'border-top-color': style.borderTopColor,
        'border-radius': style.borderRadius,
        'box-shadow': style.boxShadow.slice(0, 120),
        opacity: style.opacity,
        transform: style.transform,
        '::before': pseudo('::before'),
        '::after': pseudo('::after')
      };
    });
};

/** A page visited on one server as the same visitor on both (`visit.ts`), and drawn line by line. */
const readOn = async (
  browser: Browser,
  origin: string,
  path: string,
  { except, ...view }: VisitView & Visitor & { except: readonly string[] }
): Promise<DrawnElement[]> => {
  const { page, answered, problem } = await openVisit(browser, origin, path, view);
  try {
    if (!answered) {
      throw new Error(problem ?? `nothing answers at ${origin}${path}`);
    }

    return await page.evaluate(drawing, except);
  } finally {
    await page.close();
  }
};

/** The first element two drawings differ by — one longer than the other differs where the shorter ends — or none. */
export const firstDifference = (
  here: readonly DrawnElement[],
  there: readonly DrawnElement[]
): Difference | undefined => {
  const same = (a: DrawnElement | undefined, b: DrawnElement | undefined): boolean =>
    JSON.stringify(a) === JSON.stringify(b);
  const at = here.findIndex((element, index) => !same(element, there[index]));
  if (at === -1 && here.length === there.length) {
    return undefined;
  }

  const index = at === -1 ? Math.min(here.length, there.length) : at;
  const [mine, theirs] = [here.at(index), there.at(index)];
  const nameOf = (element: DrawnElement): string => element.name || element.tag || 'an element';
  if (mine === undefined || theirs === undefined) {
    const drawn = mine ?? theirs;

    return { element: drawn ? nameOf(drawn) : 'an element', changed: [], only: mine ? 'here' : 'there' };
  }

  const changedAt = (index: number): Difference['changed'] => {
    const [ours, others] = [here[index] ?? {}, there[index] ?? {}];

    return [...new Set([...Object.keys(ours), ...Object.keys(others)])]
      .filter(field => ours[field] !== others[field])
      .map(field => ({ field, here: ours[field] ?? '', there: others[field] ?? '' }));
  };
  const changed = changedAt(index);
  // Down the elements inside it, while each that differs is inside the one before: the last is what grew.
  const depthAt = (index: number): number => Number(here[index]?.depth ?? 0);
  let inner = index;
  for (let next = index + 1; next < here.length && depthAt(next) > depthAt(index); next += 1) {
    if (depthAt(next) <= depthAt(inner)) {
      break;
    }

    if (!same(here[next], there[next])) {
      inner = next;
    }
  }

  const inside = inner === index ? undefined : { element: nameOf(here[inner]), changed: changedAt(inner) };

  return {
    element: nameOf(mine),
    changed,
    ...(changed.every(each => each.field === 'words') ? { wordsOnly: true as const } : {}),
    ...(inside ? { inside } : {})
  };
};

/** Each page read on both servers in one browser: the same, or where it differs. */
export const samePages = async (
  browser: Browser,
  paths: readonly string[],
  options: SameAsk,
  visit: Pick<VisitView, 'timezone' | 'presence' | 'conditions'> & Visitor = {}
): Promise<Sameness[]> => {
  const view = {
    ...visit,
    width: options.width ?? 1440,
    except: options.except ?? [],
    ...(options.scheme ? { scheme: options.scheme } : {})
  };
  const read: Sameness[] = [];
  for (const path of paths) {
    try {
      const [here, there] = await Promise.all([
        readOn(browser, new URL(options.url).origin, path, view),
        readOn(browser, new URL(options.compare).origin, path, view)
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

/**
 * The pages read on both servers in a browser of its own, as the project's account reads them — the visitor every page
 * command reads as by itself: what a look holds a task's pages to, beside the run before it.
 */
export const drawnSame = async (
  root: string,
  paths: readonly string[],
  ask: SameAsk,
  visit: Pick<VisitView, 'timezone' | 'presence' | 'conditions'>
): Promise<Sameness[] | { problem: string }> => {
  const visitor = (await visitorAsked(root, {})) ?? {};
  const browser = await launchBrowser(root);
  if ('problem' in browser) {
    return browser;
  }

  try {
    return await samePages(browser, paths, ask, { ...visit, ...visitor });
  } finally {
    await browser.close();
  }
};
