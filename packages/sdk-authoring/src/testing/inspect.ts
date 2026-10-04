import { onScreen } from './onScreen';
import { probePage } from './probe';

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
  skip?: ('images' | 'overflow' | 'legibility')[];
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
  'not-rendered' | 'element-missing' | 'element-hidden' | 'image-not-loaded' | 'sideways-scroll' | 'illegible-text';

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
  /** How many elements were owed and checked. */
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
    ...findings.brokenImages.map(({ source, elementId }): PageIssue => ({
      code: 'image-not-loaded',
      message: `an image never loaded: ${source}`,
      ...about(elementId)
    })),
    ...sidewaysOf(findings.overflow),
    ...findings.illegible.map(({ text, elementId }): PageIssue => ({
      code: 'illegible-text',
      message: `text drawn in the colour behind it: ${text}`,
      ...about(elementId)
    }))
  ];
};

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

/** Checks that need no space: what any rendered page owes, whoever wrote it. */
export type DocumentChecks = Pick<InspectOptions, 'skip' | 'timeout'>;

const inspect = async (
  driver: PageEvaluator,
  page: string,
  expected: ElementHandle[],
  options: DocumentChecks
): Promise<PageReport> => {
  const skip = new Set(options.skip ?? []);
  const input: ProbeInput = {
    expected: expected.map(handle => ({ id: handle.id, selector: handle.selector })),
    images: !skip.has('images'),
    overflow: !skip.has('overflow'),
    legibility: !skip.has('legibility')
  };
  const deadline = Date.now() + (options.timeout ?? 5000);
  for (;;) {
    const findings = await driver.evaluate(probePage, input);
    const issues = issuesOf(expected, findings);
    if (issues.length === 0 || Date.now() >= deadline) {
      return {
        page,
        checked: expected.length,
        problems: issues.map(issue => issue.message),
        issues,
        hiddenAtWidth: findings.byWidth
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

  return inspect(driver, page, onScreen(handles, page, options), options);
};

/**
 * The half of `inspectPage` that needs no space: images, sideways scroll, legibility — for a page whose documents are
 * not in hand, like an example served by somebody else's server. `page` in the report is `document`.
 */
export const inspectDocument = async (driver: PageEvaluator, options: DocumentChecks = {}): Promise<PageReport> =>
  inspect(driver, 'document', [], options);
