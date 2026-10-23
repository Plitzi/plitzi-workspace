import { accessibilityInPage } from './accessibility';
import { onScreen, onScreenIfChosen } from './onScreen';
import { probePage } from './probe';

import type { AccessibilityFindings } from './accessibility';
import type { OnScreenOptions } from './onScreen';
import type { ProbeFindings, ProbeInput } from './probe';
import type { ElementHandle, SpaceHandles } from '../schema';

/**
 * A page a function can be evaluated in — Playwright's `Page`, Puppeteer's, or anything with the same method.
 *
 * Structural, like `LocatorSource`, so this package names no driver and installs none.
 */
export interface PageEvaluator {
  evaluate<R>(fn: (input: ProbeInput) => R, input: ProbeInput): Promise<R>;
}

export interface InspectOptions extends OnScreenOptions {
  /** The page that is open, by id or slug. Defaults to the home page (`/`), or the first page there is. */
  page?: string;
  /** Checks to leave out, for a page that is known to break one of them on purpose. All are on by default. */
  skip?: ('images' | 'overflow' | 'legibility' | 'accessibility')[];
  /**
   * How long to keep looking before reporting, in milliseconds — 5000 by default, like an assertion's own retry.
   *
   * A page is inspected the moment it is asked, and a provider still answering is a missing element for a few frames,
   * so the probe runs again until it finds nothing or the time is up. `0` looks once.
   */
  timeout?: number;
}

/** What kind of problem a page check found: what a tool branches on, where `message` is what a person reads. */
export type PageIssueCode =
  | 'not-rendered'
  | 'element-missing'
  | 'element-hidden'
  | 'image-not-loaded'
  | 'sideways-scroll'
  | 'cut-off'
  | 'illegible-text'
  | 'heading-skipped'
  | 'control-unnamed';

export interface PageIssue {
  code: PageIssueCode;
  /** The sentence, as `problems` holds it. */
  message: string;
  /** The space's element it is about, by id — absent for one about the page as a whole, or outside every element. */
  elementId?: string;
}

export interface PageReport {
  /** The page that was inspected, by id. */
  page: string;
  /**
   * How many elements were owed and checked — what an element that chooses its children drew counted in, and what it
   * did not draw left out.
   */
  checked: number;
  /**
   * Everything wrong, one sentence each, naming the element and the reason — empty when the page is whole.
   *
   * A list, so a suite asserts it once (`expect(report.problems).toEqual([])`) and a failure prints every problem
   * together, instead of stopping at the first locator that timed out and saying only that it did.
   */
  problems: string[];
  /** The same problems as data — each with its `code` and the element it is about — for a tool to act on. */
  issues: PageIssue[];
  /**
   * Owed, and hidden at this width on purpose — a breakpoint's `display: none`, the menu a phone shows instead: not a
   * problem, and said so a reader knows they were looked at. Checked at the width they show at.
   */
  hiddenAtWidth: string[];
  /**
   * Owed containers with nothing in them and no size of their own — a layout's shell a later part fills: nothing a
   * visitor misses, and said so. A container that should hold something is a page check's `--expect` on what it holds.
   */
  empty: string[];
  /** Owed controls put out of use on purpose — transparent and taking no press: an arrow at its row's end. Said. */
  outOfUse: string[];
}

const label = (handle: ElementHandle): string => `${handle.type} "${handle.id}"`;

const about = (elementId: string | undefined): { elementId?: string } => (elementId === undefined ? {} : { elementId });

const sidewaysOf = (overflow: ProbeFindings['overflow']): PageIssue[] =>
  overflow
    ? [
        {
          code: 'sideways-scroll',
          message: `the page scrolls sideways by ${overflow.pixels}px — widest: ${overflow.widest.join(', ')}`,
          ...about(overflow.elementIds.at(0))
        }
      ]
    : [];

/** The findings as issues. Separate from the probe so what a failure SAYS is tested without a browser. */

/** An image's address that is still a binding — `{{ list.item.cutout }}`, sent as it was written: nothing it read had it. */
const isUnbound = (source: string): boolean => {
  try {
    return decodeURIComponent(source).includes('{{');
  } catch {
    return source.includes('{{');
  }
};

/**
 * The images whose address is still a binding, said once with why: what they read has no value — a row the data has
 * none of (an address naming an id nobody has), or a field it lacks. One "never loaded" each read as a broken server
 * (la-velada's /boxeadores/ibai: four of them).
 */
const unboundImages = (images: readonly { source: string; elementId?: string }[]): PageIssue[] => {
  const bindings = [
    ...new Set(
      images.flatMap(image => {
        if (!isUnbound(image.source)) {
          return [];
        }

        let decoded = image.source;
        try {
          decoded = decodeURIComponent(image.source);
        } catch {
          // An address that is not percent-encoded is read as it is.
        }

        return [/\{\{[^}]*\}\}/.exec(decoded)?.[0] ?? decoded];
      })
    )
  ];

  return bindings.length === 0
    ? []
    : [
        {
          code: 'image-not-loaded',
          message: `${String(bindings.length)} image address(es) still a binding — ${bindings.slice(0, 3).join(', ')}${bindings.length > 3 ? ', …' : ''}: what they read has no value here — a row the page's data has none of (an address naming an id nobody has?), or a field it lacks`
        }
      ];
};

export const issuesOf = (expected: ElementHandle[], findings: ProbeFindings): PageIssue[] => {
  if (!findings.marked && expected.length > 0) {
    return [
      {
        code: 'not-rendered',
        message:
          'nothing on the page carries data-plitzi-el — the space did not render here, or it renders with ' +
          '`testAttributes: false`'
      }
    ];
  }

  const byId = new Map(expected.map(handle => [handle.id, handle]));
  const named = (id: string): string => {
    const handle = byId.get(id);

    return handle ? label(handle) : `"${id}"`;
  };

  return [
    ...findings.missing.map((id): PageIssue => ({
      code: 'element-missing',
      message: `${named(id)} is not on the page`,
      elementId: id
    })),
    ...findings.hidden.map(({ id, reason }): PageIssue => ({
      code: 'element-hidden',
      message: `${named(id)} is on the page but not visible: ${reason}`,
      elementId: id
    })),
    ...unboundImages(findings.brokenImages),
    ...unloadedImages(findings.brokenImages.filter(image => !isUnbound(image.source))),
    ...sidewaysOf(findings.overflow),
    ...findings.cutOff.map(({ id, pixels }): PageIssue => ({
      code: 'cut-off',
      message: `${named(id)} is cut off at the edge of the screen by ${String(pixels)}px — an ancestor hides what spills past it, so nothing scrolls to it: let the row wrap, or give it room`,
      elementId: id
    })),
    ...findings.illegible.map(({ text, contrast, elementId }): PageIssue => ({
      code: 'illegible-text',
      message: `text that cannot be told from what is behind it — contrast ${String(contrast)}:1, where body text asks 4.5:1: ${text}. A colour meant for one theme, painted in the other, is the usual cause: read the space's tokens (\`var(--…)\`), never a fixed colour`,
      ...about(elementId)
    }))
  ];
};

/** Past this many from one server, the images that did not load are one finding: its server, how many, a few of them. */
const IMAGES_APART = 3;

/**
 * The images that did not load, each a finding — or, past `IMAGES_APART` from one server, one for that server: a page of
 * twenty fighters on a slow CDN buried the rest of its check under twenty lines (velada-dress, t-404).
 */
const unloadedImages = (images: readonly { source: string; elementId?: string; loading?: boolean }[]): PageIssue[] => {
  const hostOf = (source: string): string => {
    try {
      return new URL(source).host;
    } catch {
      return '';
    }
  };
  const byHost = new Map<string, typeof images>();
  for (const image of images) {
    byHost.set(hostOf(image.source), [...(byHost.get(hostOf(image.source)) ?? []), image]);
  }

  return [...byHost].flatMap(([host, some]): PageIssue[] =>
    some.length > IMAGES_APART && host !== ''
      ? [
          {
            code: 'image-not-loaded',
            message: `${String(some.length)} images from ${host} did not load (${some
              .slice(0, IMAGES_APART)
              .map(image => image.source.split('/').at(-1) ?? image.source)
              .join(', ')}, …) — its server is slow, refuses this browser, or never answers`
          }
        ]
      : some.map(({ source, elementId, loading }): PageIssue => ({
          code: 'image-not-loaded',
          message: loading
            ? `an image was still loading after ${String(IMAGE_WAIT_MS / 1000)} s: ${source} — its server is slow, or never answers`
            : `an image never loaded: ${source}`,
          ...about(elementId)
        }))
  );
};

/** What a screen reader would meet, as issues: a heading out of order, a control with no name. */
export const accessibilityIssues = (found: AccessibilityFindings): PageIssue[] => [
  ...found.skippedHeadings.map(({ text, level, after, elementId }): PageIssue => ({
    code: 'heading-skipped',
    message:
      after === 0
        ? `the page's headings start at h${String(level)} ("${text}"): its first is its h1 — the title a reader is told the page is`
        : `heading h${String(level)} ("${text}") comes after an h${String(after)}: a level is skipped, and a reader moving by headings loses where it is — make it an h${String(after + 1)}, its look a class of its own`,
    ...about(elementId)
  })),
  ...found.unnamed.map(({ what, elementId }): PageIssue => ({
    code: 'control-unnamed',
    message: `${what} has no name a screen reader can read — its words, an image's alt, or the element's \`label\` for one drawn as an icon`,
    ...about(elementId)
  }))
];

/** The findings as sentences — what `problems` holds. */
export const describeFindings = (expected: ElementHandle[], findings: ProbeFindings): string[] =>
  issuesOf(expected, findings).map(issue => issue.message);

const defaultPage = (handles: SpaceHandles): string => {
  const pages = Object.values(handles.pages);
  const home = pages.find(page => page.path === '/') ?? pages.at(0);
  if (!home) {
    throw new Error('This space has no page to inspect');
  }

  return home.id;
};

const pause = (milliseconds: number): Promise<void> => new Promise(resolve => setTimeout(resolve, milliseconds));

/**
 * How long a page is waited for when all that is left is images on their way — a CDN slow under many checks at once
 * answers them late, and an image still coming is not one that failed.
 */
const IMAGE_WAIT_MS = 20_000;

/** Checks that need no space: what any rendered page owes, whoever wrote it. */
export type DocumentChecks = Pick<InspectOptions, 'skip' | 'timeout'>;

/** An element owed, as the probe is asked about it. */
type Expected = { handle: ElementHandle; shownWith?: string };

const inspect = async (
  driver: PageEvaluator,
  page: string,
  owed: Expected[],
  options: DocumentChecks
): Promise<PageReport> => {
  const skip = new Set(options.skip ?? []);
  const expected = owed.map(({ handle }) => handle);
  const input: ProbeInput = {
    expected: owed.map(({ handle, shownWith }) => ({
      id: handle.id,
      selector: handle.selector,
      ...(handle.type === 'list' ? { list: true as const } : {}),
      ...(handle.type === 'container' ? { container: true as const } : {}),
      ...(shownWith === undefined ? {} : { shownWith })
    })),
    images: !skip.has('images'),
    overflow: !skip.has('overflow'),
    legibility: !skip.has('legibility')
  };
  const deadline = Date.now() + (options.timeout ?? 5000);
  const imagesDeadline = Date.now() + Math.max(IMAGE_WAIT_MS, options.timeout ?? 5000);
  for (;;) {
    const findings = await driver.evaluate(probePage, input);
    const issues = [
      ...issuesOf(expected, findings),
      ...(skip.has('accessibility') ? [] : accessibilityIssues(await driver.evaluate(accessibilityInPage, input)))
    ];
    const onlyLoading =
      issues.length > 0 && issues.length === findings.brokenImages.filter(image => image.loading).length;
    if (issues.length === 0 || Date.now() >= (onlyLoading ? imagesDeadline : deadline)) {
      return {
        page,
        checked: expected.length - findings.notDrawn.length,
        problems: issues.map(issue => issue.message),
        issues,
        hiddenAtWidth: findings.byWidth,
        empty: findings.empty,
        outOfUse: findings.outOfUse
      };
    }

    await pause(100);
  }
};

/**
 * Everything wrong with an open page, as one list: every element it owes (see `onScreen`) present and visible, its
 * images loaded, nothing scrolling sideways, no text in the colour behind it.
 *
 * ```ts
 * const { handles, schema, style } = authorSpace(space);
 * await page.goto('/');
 * expect((await inspectPage(page, handles)).problems).toEqual([]);
 * ```
 *
 * The one call a suite needs for "this page rendered whole", in any space and with no upkeep — and the one that says
 * WHY when it did not: which ancestor hid an element, which one overflowed, which image failed.
 */
export const inspectPage = async (
  driver: PageEvaluator,
  handles: SpaceHandles,
  options: InspectOptions = {}
): Promise<PageReport> => {
  const page = handles.page(options.page ?? defaultPage(handles)).id;
  const owed: Expected[] = [
    ...onScreen(handles, page, options).map(handle => ({ handle })),
    ...onScreenIfChosen(handles, page, options).flatMap(handle =>
      handle.shownWith === undefined ? [] : [{ handle, shownWith: handles.element(handle.shownWith).selector }]
    )
  ];

  return inspect(driver, page, owed, options);
};

/**
 * The half of `inspectPage` that needs no space: images, sideways scroll, legibility — for a page whose documents are
 * not in hand, like an example served by somebody else's server. `page` in the report is `document`.
 */
export const inspectDocument = async (driver: PageEvaluator, options: DocumentChecks = {}): Promise<PageReport> =>
  inspect(driver, 'document', [], options);
