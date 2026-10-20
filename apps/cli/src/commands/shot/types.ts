import type { BrowserPage, Scheme } from '../../browser';
import type { FieldFill } from '../../options';
import type { Account } from '../check';
import type { TextComparison } from '@plitzi/sdk-authoring';

/**
 * What a picture of a page is asked and answers, and the measures it is taken by.
 */

/** When a run's first picture is taken: once the page settles, or as soon as its HTML is in. */
export const SHOT_MOMENTS = ['settled', 'load'] as const;

export type ShotMoment = (typeof SHOT_MOMENTS)[number];

export interface ShotOptions {
  /** The numbers and the scheme are validated where the flags are declared (options.ts). */
  width?: number;
  height?: number;
  /** The space's theme. Left out, the space's own default — and the file is named by the one painted. */
  scheme?: Scheme;
  out?: string;
  /** Where the project is served, when not by `npm start` here: a second server of it, staging, a deploy. */
  url?: string;
  compare?: string;
  frames?: number;
  every?: number;
  waitFor?: string;
  reducedMotion?: boolean;
  /** One element only: its name (`data-plitzi-el`) or a CSS selector. */
  clip?: string;
  /** The page scrolled until this element is in view — and, with `viewport`, the screen there. */
  scrollTo?: string;
  /** What fits the viewport, rather than the whole page. */
  viewport?: boolean;
  /**
   * Elements clicked one after another once the page settles — each its name or a CSS selector, which reaches inside a
   * plugin too — with what each click changed pictured: `frames` pictures `every` ms apart after each, or one.
   */
  click?: string[];
  /** Every picture taken — before, after each click, or each of `frames` — on one contact sheet. */
  sheet?: boolean;
  /** Signed in first as this account, the password from `PLITZI_CHECK_PASSWORD` — as `page check --as` does. */
  as?: string;
  /** Taking part in the page's channels — arriving, announcing itself — as a visitor does, so the others see it. */
  presence?: boolean;
  /** When the first picture is taken: once the page settles (the default), or as soon as its HTML is in. */
  from?: ShotMoment;
  /** A script of steps played on the page (`shotSteps.ts`), or `@file` holding one. */
  steps?: string;
  /** Fields typed into first, as `page check --fill` does: the steps `type`, before the clicks or alone, then a picture. */
  fill?: FieldFill[];
  json?: boolean;
}

/**
 * What a picture holds: the whole page (with its sections, which a diff is reported by), what the screen shows, or one
 * element. Every picture of one run — the first, a compared one, each frame — is taken the same way.
 */
export type Framing = { kind: 'page' } | { kind: 'viewport' } | { kind: 'element'; selector: string };

export type RegionChange = { name: string; changed: number; shift?: number };

export interface CompareReport {
  url: string;
  changed: number;
  /** How tall each page is: two pages of different heights are compared section by section. */
  heights: { here: number; there: number };
  /** The first section the other page has somewhere else, and how far down. */
  driftFrom?: { name: string; shift: number };
  regions: RegionChange[];
  /** `--clip` with `--compare`: the one section the regions were kept to — the rest of the report is the whole page's. */
  section?: string;
  /** The words both pages have, and what each does differently there. */
  texts: TextComparison;
  /** Pictures the other page had not drawn when it was taken. */
  unloaded: number;
  sideBySide: string;
  diff: string;
}

export interface ShotReport {
  path: string;
  width: number;
  /** The theme the page was painted in. */
  scheme: Scheme;
  out: string;
  compare?: CompareReport;
  frames?: { count: number; every: number; moving: RegionChange[]; still: string[] };
  /** How many arrivals that wait for the scroll (`on: 'view'` or `'scroll'`) the whole-page picture shows as they end. */
  settled?: number;
  /** Pictures of this page not drawn when it was taken. */
  unloaded?: number;
  /** Where the page sent the browser instead — a page for signed-in visitors, to the sign-in: the picture is of that. */
  sentTo?: string;
  /** With `click`: each element clicked, and the share of the picture that changed after it. */
  clicked?: { target: string; changed: number }[];
  /** With `steps`: each picture the script took, and the share of it that changed since the one before. */
  steps?: { label: string; changed: number }[];
  /** The pictures after the first, each with what it shows — or, with `sheet`, the one sheet that holds them all. */
  pictures?: { label: string; out: string }[];
  sheet?: string;
}

/** One picture of a page as it plays: what it shows — `before`, `<target> +250 ms` — and the picture. */
export interface Moment {
  label: string;
  png: Uint8Array;
}

export interface View {
  width: number;
  height: number;
  scheme?: Scheme;
  reducedMotion: boolean;
  waitFor?: string;
  clip?: string;
  scrollTo?: string;
  viewport?: boolean;
  /** Every declared motion held at its end: a whole page taken in one picture, never scrolled. */
  still: boolean;
  /** Signed in as first — on the project's own page only, never another site's. */
  account?: Account;
  /** Taking part in the project page's channels; otherwise it only watches them. */
  presence?: boolean;
  /** The first picture taken as soon as the HTML is in, not once the page settles: what plays while it loads. */
  fromLoad?: boolean;
}

export interface Taken {
  page: BrowserPage;
  /** How each picture of it is taken: the element `clip` named, found on this page. */
  how: Framing;
  png: Uint8Array;
  scheme: Scheme;
  settled: number;
  unloaded: number;
  sentTo?: string;
}

/** A region moves when more than this share of it changed between two frames: below is anti-aliasing and carets. */
export const MOVING_PERCENT = 0.5;

/** How long a whole page waits for its pictures before it is taken anyway. */
export const IMAGES_BUDGET_MS = 8000;

/** How many texts that differ are written out; `--json` has every one. */
export const TEXTS_SHOWN = 12;

/** A shift within this is where it was: a pixel or two is rounding. */
export const DRIFT_PX = 2;

/** An arrival that waits for the scroll and has not had it: one waiting to be seen, or one tied to the scroll. */
export const WAITING_FOR_SCROLL = '[data-motion-on="view"]:not([data-motion-seen]), [data-motion-on="scroll"]';

export const BARE = /^[\w-]+$/;
