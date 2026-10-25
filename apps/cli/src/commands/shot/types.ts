import type { BrowserPage, Scheme } from '../../browser';
import type { FieldFill } from '../../options';
import type { Account } from '../check';
import type { PartCompared } from './compare';
import type { SectionDecorations, TextComparison } from '@plitzi/sdk-authoring';

/**
 * What a picture of a page is asked and answers, and the measures it is taken by.
 */

/** When a run's first picture is taken: once the page settles, or as soon as its HTML is in. */
export const SHOT_MOMENTS = ['settled', 'load'] as const;

export type ShotMoment = (typeof SHOT_MOMENTS)[number];

export interface ShotOptions {
  /** `--json` at several widths: each width's report handed here, for one object of them all, not printed one by one. */
  collect?: (report: ShotReport) => void;
  /** The numbers and the scheme are validated where the flags are declared (options.ts). */
  width?: number;
  height?: number;
  /**
   * The picture this many times as large, the layout as at its width — a small drawing read cell by cell: a run's
   * designer printed its pixel mark as text with a script of its own, page shot having no zoom.
   */
  scale?: number;
  /** The space's theme. Left out, the space's own default — and the file is named by the one painted. */
  scheme?: Scheme;
  out?: string;
  /** Where the project is served, when not by `npm start` here: a second server of it, staging, a deploy. */
  url?: string;
  compare?: string;
  /** With `compare`: the site as it is now, even where the run kept it (`plitzi run reference`). */
  live?: boolean;
  /**
   * With `compare`: fail where a section lacks a look the other page dresses it in — an acceptance's check; a text, only
   * the looks that name it (`radial-gradient across`, `shadow`, `::before`, `background image`, `filter`).
   */
  dress?: boolean | string;
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
  /** Hovered once the page settles — after the clicks, an item of what they opened — and the page pictured so. */
  hover?: string;
  /** Every picture taken — before, after each click, or each of `frames` — on one contact sheet. */
  sheet?: boolean;
  /** Signed in first as this account, the password from `PLITZI_CHECK_PASSWORD` — as `page check --as` does. */
  as?: string;
  /** Taking part in the page's channels — arriving, announcing itself — as a visitor does, so the others see it. */
  presence?: boolean;
  /** `--timezone <IANA>`: the visitor's time zone, the browser's clock read in — the machine's when left out. */
  timezone?: string;
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
/**
 * How a picture is framed. An element's clip a click or a step opens (an FAQ's answer) is found as each picture is taken
 * (`later`): before the click it is not on the page, and the shot said "not on" (a run's design-1).
 */
export type Framing =
  | { kind: 'page' }
  | { kind: 'viewport' }
  | { kind: 'element'; selector: string }
  | { kind: 'element-later'; target: string };

export type RegionChange = { name: string; element?: string; changed: number; shift?: number };

export interface CompareReport {
  url: string;
  /** Measured against the page as the run kept it (`plitzi run reference`), when: not the site as it is now. */
  keptAt?: string;
  changed: number;
  /** How tall each page is: two pages of different heights are compared section by section. */
  heights: { here: number; there: number };
  /** The first section the other page has somewhere else, and how far down. */
  driftFrom?: { name: string; shift: number };
  regions: RegionChange[];
  /** `--clip` with `--compare`: the one section the regions were kept to — the rest of the report is the whole page's. */
  section?: string;
  /**
   * `--click` with `--compare`: the state both pages were pictured in, the clicks of each in words — what is on the
   * screen once each was clicked, a drawer, a panel (a run's designer clicked the original by a script of its own).
   */
  state?: string;
  /**
   * That section lined up with a part of the other page that is not it: what its numbers measure is something else —
   * said, never a "99.5% differs" read as the section's (sponsors against the original's hero).
   */
  misaligned?: string;
  /** The words both pages have, and what each does differently there. */
  texts: TextComparison;
  /** Each section whose dress — gradients, glows, ornaments, background images — differs, and how. */
  decorations: SectionDecorations[];
  /** Pictures the other page had not drawn when it was taken. */
  unloaded: number;
  sideBySide: string;
  diff: string;
  /**
   * A page too tall to read side by side whole: each section that changed most, cut from it, both sides — a run's look
   * wrote a 780×13779 picture whose top was no section at all.
   */
  sections?: string[];
}

export interface ShotReport {
  /** `--dress`: each kind of dress a section lacks that the other page has — the check failed by them. */
  dressMissing?: string[];
  path: string;
  width: number;
  /** The theme the page was painted in. */
  scheme: Scheme;
  out: string;
  compare?: CompareReport;
  /** `--clip a,b` beside the project's other server: each part's comparison, or why it could not be pictured. */
  parts?: PartCompared[];
  /** `slight`: a region of a whole page that changed by `MOVING_PERCENT` or less — a caret, or a small part moving. */
  frames?: { count: number; every: number; moving: RegionChange[]; slight: RegionChange[]; still: string[] };
  /** How many arrivals that wait for the scroll (`on: 'view'` or `'scroll'`) the whole-page picture shows as they end. */
  settled?: number;
  /** Pictures of this page not drawn when it was taken. */
  unloaded?: number;
  /** Embeds from another site below the first screen: blank in a whole-page picture, which the browser draws only on screen. */
  undrawn?: string[];
  /** Where the page sent the browser instead — a page for signed-in visitors, to the sign-in: the picture is of that. */
  sentTo?: string;
  /** With `click`: each element clicked, and the share of the picture that changed after it. */
  /** Each click, what it changed — or that it opened the clip, pictured alone after it (`opened`). */
  clicked?: { target: string; changed: number; opened?: true }[];
  /** With `steps`: each picture the script took, and the share of it that changed since the one before. */
  steps?: { label: string; changed: number }[];
  /** The pictures after the first, each with what it shows — or, with `sheet`, the one sheet that holds them all. */
  pictures?: { label: string; out: string }[];
  sheet?: string;
  /**
   * A whole page taller than `TILED_SCREENS` screens, in parts a screen and a half tall each: read whole, a phone's
   * page (390 × 8052) was shrunk to 97 px wide and nothing of it could be read (a run's design-2).
   */
  tiles?: string[];
}

/** One picture of a page as it plays: what it shows — `before`, `<target> +250 ms` — and the picture. */
export interface Moment {
  label: string;
  png: Uint8Array;
}

export interface View {
  width: number;
  height: number;
  /** Device pixels a CSS pixel: `--scale`. */
  scale?: number;
  scheme?: Scheme;
  reducedMotion: boolean;
  waitFor?: string;
  clip?: string;
  scrollTo?: string;
  viewport?: boolean;
  /** Every declared motion held at its end: one picture — the whole page, a part clipped or scrolled to — not frames. */
  still: boolean;
  /** Signed in as first — on the project's own page only, never another site's. */
  account?: Account;
  /** Taking part in the project page's channels; otherwise it only watches them. */
  presence?: boolean;
  /** The first picture taken as soon as the HTML is in, not once the page settles: what plays while it loads. */
  fromLoad?: boolean;
  /**
   * Another site's pictures stood in for, each by one of its own colour: two pages of the project set side by side
   * (`--compare` with the run before a task) differ only by what the project changed, never by which of a busy CDN's
   * pictures loaded on which side (21–31% "differs" at 390, from 429s).
   */
  standIns?: boolean;
  /** The visitor's time zone (IANA): the page as one there sees its hours — the machine's when left out. */
  timezone?: string;
  /** Clicks or steps follow: a clip not on the page yet is one they open, found as each picture is taken. */
  clipLater?: boolean;
}

export interface Taken {
  page: BrowserPage;
  /** How each picture of it is taken: the element `clip` named, found on this page. */
  how: Framing;
  png: Uint8Array;
  scheme: Scheme;
  settled: number;
  unloaded: number;
  undrawn: string[];
  sentTo?: string;
}

/** A region moves when more than this share of it changed between two frames: below is anti-aliasing and carets. */
export const MOVING_PERCENT = 0.5;

/** How long a page waits for its pictures before it is taken anyway. */
export const IMAGES_BUDGET_MS = 8000;

/**
 * …and another site, whose pictures come from its CDN: a reference taken before its footer photo loaded told a spike
 * the original had none.
 */
export const REMOTE_IMAGES_BUDGET_MS = 20_000;

/** How many texts that differ are written out; `--json` has every one. */
export const TEXTS_SHOWN = 12;

/** A shift within this is where it was: a pixel or two is rounding. */
export const DRIFT_PX = 2;

/** An arrival that waits for the scroll and has not had it: one waiting to be seen, or one tied to the scroll. */
export const WAITING_FOR_SCROLL = '[data-motion-on="view"]:not([data-motion-seen]), [data-motion-on="scroll"]';

export const BARE = /^[\w-]+$/;
