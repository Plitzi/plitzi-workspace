import { drawnOn } from './drawn';
import { INHERITED, MEASURED, PSEUDO_MEASURED, PSEUDOS } from './measureValues';
import { targetOn } from './shot/capture';
import { notOnPageText } from './shot/notOnPage';

import type { Measured, MeasuredExtra } from './measureValues';
import type { BrowserPage, LayoutSession } from '../../browser';

/** One element of an open page, read as `page measure` reads it: found by any name, its first shown, measured. */

/** How long a picture measured is waited for before it is read as it is: a picture that never loads holds nothing. */
const IMAGE_WAIT_MS = 5000;

/** How many matches of a selector are looked through for the first one shown. */
const SHOWN_LOOK = 20;

/**
 * The first match of `selector` a visitor sees, as a selector: itself when it is the first, `… >> nth=N` when an
 * earlier one is hidden, and itself again when none is shown — measured as it is, and said hidden.
 */
const firstShown = async (page: BrowserPage, selector: string): Promise<{ selector: string; hidden: boolean }> => {
  for (let index = 0; index < SHOWN_LOOK; index += 1) {
    const nth = `${selector} >> nth=${String(index)}`;
    const match = page.locator(nth).first();
    if ((await match.count()) === 0) {
      break;
    }

    if (await match.isVisible()) {
      return { selector: index === 0 ? selector : nth, hidden: false };
    }
  }

  return { selector, hidden: true };
};

/**
 * Why an element is drawn nowhere, as a visitor's browser has it — the nearest cause, its own or around it. Runs in the
 * page, self-contained.
 */
export const hiddenWhyInPage = (node: Element): string => {
  const nameOf = (element: Element): string =>
    element.getAttribute('data-plitzi-el') ?? element.getAttribute('data-plitzi-instance') ?? element.localName;
  const where = (element: Element): string => (element === node ? '' : ` on ${nameOf(element)}, around it`);
  for (let at: Element | null = node; at !== null; at = at.parentElement) {
    if (at.hasAttribute('hidden') || getComputedStyle(at).display === 'none') {
      return `display: none${where(at)}`;
    }
  }

  const own = getComputedStyle(node);
  if (own.visibility !== 'visible') {
    return `visibility: ${own.visibility}`;
  }

  const box = node.getBoundingClientRect();

  return box.width === 0 || box.height === 0
    ? `no size: ${String(Math.round(box.width))} × ${String(Math.round(box.height))} px`
    : 'not drawn';
};

/** What of a pseudo-element is read off its box, not its computed style. */
const PLACED = new Set(['x', 'y']);

/**
 * Where each of `pseudos` of the element `selector` finds is drawn, off Chromium's layout: its border box's corner,
 * `y` down the page (`scrolled`), as an element's `x` and `y` are said.
 */
export const pseudoBoxes = async (
  session: LayoutSession,
  selector: string,
  pseudos: readonly string[],
  scrolled: number
): Promise<Record<string, string>> => {
  const { root } = await session.send('DOM.getDocument', { depth: 0 });
  const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  const { node } = await session.send('DOM.describeNode', { nodeId, depth: 0 });
  const placed: Record<string, string> = {};
  for (const pseudo of node.pseudoElements ?? []) {
    if (pseudo.pseudoType === undefined || !pseudos.includes(pseudo.pseudoType)) {
      continue;
    }

    const { model } = await session.send('DOM.getBoxModel', { backendNodeId: pseudo.backendNodeId });
    const [left = 0, top = 0] = model.border;
    // To the hundredth, as a width is said: a 1px hairline's place was matched against three values, each rounded alike.
    placed[`${pseudo.pseudoType}:x`] = `${String(Number(left.toFixed(2)))}px`;
    placed[`${pseudo.pseudoType}:y`] = `${String(Number((top + scrolled).toFixed(2)))}px`;
  }

  return placed;
};

/**
 * Where each pseudo-element drawn is: the page has no box of one, so it is asked of Chromium's own layout, the element
 * marked for it a moment. Nothing when the browser cannot say — never a guess.
 */
const pseudoPlaces = async (
  page: BrowserPage,
  selector: string,
  pseudos: readonly string[]
): Promise<Record<string, string>> => {
  const mark = `m${String(Date.now())}${String(Math.random()).slice(2, 8)}`;
  const element = page.locator(selector).first();
  const scrolled = await element.evaluate((node, value: string) => {
    node.setAttribute('data-plitzi-measured', value);

    return window.scrollY;
  }, mark);
  const session = await page
    .context()
    .newCDPSession(page)
    .catch(() => undefined);
  try {
    return session ? await pseudoBoxes(session, `[data-plitzi-measured="${mark}"]`, pseudos, scrolled) : {};
  } catch {
    return {};
  } finally {
    await session?.detach().catch(() => undefined);
    await element
      .evaluate(node => {
        node.removeAttribute('data-plitzi-measured');
      }, undefined)
      .catch(() => undefined);
  }
};

/** One element of an open page, measured — or why it could not be. */
export const measureOn = async (
  page: BrowserPage,
  target: string,
  {
    boxless,
    extra
  }: {
    /** Whether the space authors an id as an element with no box of its own — a provider with no tag. Asked when not found. */
    boxless?: (id: string) => Promise<boolean>;
    /** What is read besides what always is: properties asked by name. */
    extra?: MeasuredExtra;
  } = {}
): Promise<Measured | { problem: string }> => {
  const found = await targetOn(page, target);
  if ('problem' in found) {
    return found;
  }

  // A run's designer measured an apiContainer and was told it was not drawn, with guesses why: it was, as its children.
  if (!found.found && boxless && (await boxless(target))) {
    return {
      problem: `${target} draws no box of its own — a provider, drawn as what it holds: measure one of its children`
    };
  }

  if (!found.found) {
    return {
      problem: `No element ${target} on ${page.url()} — ${await notOnPageText(page, target, '--click, --steps')}`
    };
  }

  // Of several matches, the first a visitor sees: the original's first `.header__heading-logo` is its hidden menu
  // drawer's, and whichever the page drew first was measured — 0 px one call, 140 px the next (a run's finish).
  const shown = await firstShown(page, found.selector);
  found.selector = shown.selector;

  // A picture is measured drawn: read before it loads, an <img> sized by its own picture is 0 px wide, or "auto" tall
  // (the original's logo read 140 px one call and 0 px the next, and failed the finish). A lazy one is asked
  // for now; one that never loads is measured as it is after IMAGE_WAIT_MS.
  await page
    .locator(found.selector)
    .first()
    .evaluate(async (node, waitMs: number) => {
      if (!(node instanceof HTMLImageElement) || (node.complete && node.naturalWidth > 0)) {
        return;
      }

      node.loading = 'eager';
      await Promise.race([node.decode().catch(() => undefined), new Promise(resolve => setTimeout(resolve, waitMs))]);
    }, IMAGE_WAIT_MS)
    .catch(() => undefined);

  // A Playwright selector (`… >> nth=2`) is no CSS: its matches are not counted, as one.
  const matches = await page
    .evaluate((selector: string) => document.querySelectorAll(selector).length, found.selector)
    .catch(() => 1);

  const read = await page
    .locator(found.selector)
    .first()
    .evaluate(
      (
        node,
        {
          properties,
          pseudos,
          pseudoProperties,
          inheritable
        }: {
          properties: readonly string[];
          pseudos: readonly string[];
          pseudoProperties: readonly string[];
          inheritable: readonly string[];
        }
      ) => {
        const computed = getComputedStyle(node);
        const parent = node.parentElement ? getComputedStyle(node.parentElement) : undefined;
        const styles: Record<string, string> = Object.fromEntries(
          properties.map(property => [property, computed.getPropertyValue(property)])
        );
        const placed = node.getBoundingClientRect();
        styles.x = `${String(Math.round(placed.left))}px`;
        styles.y = `${String(Math.round(placed.top + window.scrollY))}px`;
        // The transform that applies: `translate`, `rotate` and `scale` — what Tailwind 4 writes `rotate-45` as — then
        // `transform`, as CSS composes them. Read alone, the original's diamond was "transform: none" beside ours.
        const [moved, turned, sized] = ['translate', 'rotate', 'scale'].map(property =>
          computed.getPropertyValue(property)
        );
        if ([moved, turned, sized].some(value => value !== '' && value !== 'none')) {
          const box = node.getBoundingClientRect();
          const length = (value: string, of: number): number =>
            value.endsWith('%') ? (Number.parseFloat(value) / 100) * of : Number.parseFloat(value) || 0;
          const degrees = (value: string): number =>
            value.endsWith('rad')
              ? (Number.parseFloat(value) * 180) / Math.PI
              : value.endsWith('turn')
                ? Number.parseFloat(value) * 360
                : Number.parseFloat(value) || 0;
          let matrix = new DOMMatrix();
          if (moved && moved !== 'none') {
            const [x = '0', y = '0', z = '0'] = moved.split(' ');
            matrix = matrix.translate(length(x, box.width), length(y, box.height), length(z, 0));
          }

          if (turned && turned !== 'none') {
            const words = turned.split(' ');
            const angle = degrees(words[words.length - 1] ?? '0');
            const [axis] = words;
            matrix =
              words.length === 1 || axis === 'z'
                ? matrix.rotate(0, 0, angle)
                : axis === 'x'
                  ? matrix.rotate(angle, 0, 0)
                  : axis === 'y'
                    ? matrix.rotate(0, angle, 0)
                    : matrix.rotateAxisAngle(
                        Number.parseFloat(words[0] ?? '0'),
                        Number.parseFloat(words[1] ?? '0'),
                        Number.parseFloat(words[2] ?? '1'),
                        angle
                      );
          }

          if (sized && sized !== 'none') {
            const [sx = 1, sy = sx, sz = 1] = sized
              .split(' ')
              .map(value => (value.endsWith('%') ? Number.parseFloat(value) / 100 : Number.parseFloat(value)));
            matrix = matrix.scale(sx, sy, sz);
          }

          const own = styles.transform;
          styles.transform = (own && own !== 'none' ? matrix.multiply(new DOMMatrix(own)) : matrix).toString();
        }

        for (const pseudo of pseudos) {
          const drawn = getComputedStyle(node, `::${pseudo}`);
          const content = drawn.getPropertyValue('content');
          if (content !== 'none' && content !== 'normal' && content !== '') {
            for (const property of pseudoProperties) {
              styles[`${pseudo}:${property}`] = drawn.getPropertyValue(property);
            }
          }
        }

        const tag = node.tagName.toLowerCase();
        const root = tag === 'body' || tag === 'html' ? document.querySelector('[data-plitzi-el]') : null;

        return {
          tag,
          ...(root ? { spaceRoot: root.getAttribute('data-plitzi-el') ?? '' } : {}),
          text: node.textContent.replace(/\s+/g, ' ').trim().slice(0, 60),
          // In numbers, the page's: what a line compares — a run's lead parsed "2445px" with jq to tell an overlap.
          box: {
            x: Math.round(placed.left),
            y: Math.round(placed.top + window.scrollY),
            width: Math.round(placed.width),
            height: Math.round(placed.height)
          },
          styles,
          inherited: parent
            ? inheritable.filter(property => computed.getPropertyValue(property) === parent.getPropertyValue(property))
            : []
        };
      },
      {
        properties: [...MEASURED, ...(extra?.properties ?? [])],
        pseudos: [...PSEUDOS],
        pseudoProperties: [...PSEUDO_MEASURED.filter(property => !PLACED.has(property)), ...(extra?.pseudo ?? [])],
        inheritable: [...INHERITED]
      }
    );
  const drawn = PSEUDOS.filter(pseudo => Object.hasOwn(read.styles, `${pseudo}:content`));

  return {
    selector: found.selector,
    ...(matches > 1 ? { matches } : {}),
    ...(shown.hidden
      ? {
          hidden: await page
            .locator(found.selector)
            .first()
            .evaluate(hiddenWhyInPage, undefined)
            .catch(() => 'not drawn')
        }
      : {}),
    ...read,
    styles: {
      ...read.styles,
      ...(drawn.length > 0 && !shown.hidden ? await pseudoPlaces(page, found.selector, drawn) : {}),
      ...(extra?.drawn && !shown.hidden ? await drawnOn(page, found.selector) : {})
    }
  };
};
