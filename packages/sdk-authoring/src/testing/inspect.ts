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
}

const label = (handle: ElementHandle): string => `${handle.type} "${handle.id}"`;

/** The findings as sentences. Separate from the probe so what a failure SAYS is tested without a browser. */
export const describeFindings = (expected: ElementHandle[], findings: ProbeFindings): string[] => {
  if (!findings.marked && expected.length > 0) {
    return [
      'nothing on the page carries data-plitzi-el — the space did not render here, or it renders with ' +
        '`testAttributes: false`'
    ];
  }

  const byId = new Map(expected.map(handle => [handle.id, handle]));
  const named = (id: string): string => {
    const handle = byId.get(id);

    return handle ? label(handle) : `"${id}"`;
  };

  return [
    ...findings.missing.map(id => `${named(id)} is not on the page`),
    ...findings.hidden.map(({ id, reason }) => `${named(id)} is on the page but not visible: ${reason}`),
    ...findings.brokenImages.map(source => `an image never loaded: ${source}`),
    ...(findings.overflow
      ? [`the page scrolls sideways by ${findings.overflow.pixels}px — widest: ${findings.overflow.widest.join(', ')}`]
      : []),
    ...findings.illegible.map(text => `text drawn in the colour behind it: ${text}`)
  ];
};

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
    const problems = describeFindings(expected, await driver.evaluate(probePage, input));
    if (problems.length === 0 || Date.now() >= deadline) {
      return { page, checked: expected.length, problems };
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
