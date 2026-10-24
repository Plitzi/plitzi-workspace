import type { Scheme } from '../../browser';
import type { FieldFill } from '../../options';
import type { DataIssueCode, PageIssue } from '@plitzi/sdk-authoring';

/**
 * What a page check is asked and answers: its options, each issue, the report of a page at a width.
 */

export interface CheckOptions {
  /** `--expect <id>~<text>`: each element shows its text, or the check fails — what an acceptance can be checked by. */
  expect?: Expectation[];
  /** `--themes`: each page read in light and dark too — a ground that does not follow the theme under text that does. */
  themes?: boolean;
  /** `--stand-ins`: another site's pictures stood in for — what a look checks is the task's change, not their CDN. */
  standIns?: boolean;
  /** `--status <code>`: the status every page checked is meant to be sent with. */
  status?: number;
  /** `--redirects-to <path>`: where the page is meant to send this visitor — a guest of a signed-in page, to sign in. */
  redirectsTo?: string;
  /** `--then <path…>`: on from the page by its own links, no reload — each next page checked as the visitor reaches it. */
  then?: string[];
  /** Validated where the flag is declared (`widths` in options.ts). */
  width?: number[];
  scheme?: Scheme;
  json?: boolean;
  /** The page's state and every source by name, as its dev tools hold them. */
  state?: boolean;
  /** Elements by their ids (`--element` once each): what each reads, its own state, whether it is on screen. */
  element?: string[];
  /** The HTML the server sent, held against the page once hydrated. */
  ssr?: boolean;
  /** One element clicked, by its id, once the page has settled: what changed because of it, or that nothing did. */
  click?: string;
  /**
   * One element with the pointer over it, by its id, once the page has settled: what that changed — its own look and its
   * elements', what appeared, the flows it ran — or that nothing did.
   */
  hover?: string;
  /** Fields filled before the click, as a visitor types in them: what a form's flow is sent. */
  fill?: FieldFill[];
  /**
   * An account of the project to sign in as first, through its server's `/auth` routes (`createServer({ auth })`), with
   * the password in `PLITZI_CHECK_PASSWORD` — what a page for signed-in visitors is checked as.
   */
  as?: string;
  /** Taking part in the page's channels — arriving, announcing itself, sending — as a visitor does. */
  presence?: boolean;
  /** `--timezone <IANA>`: the visitor's time zone, the browser's clock read in — the machine's when left out. */
  timezone?: string;
  /**
   * Where the project is served, when not by `npm start` here: a second server of it, staging, a deploy. Its pages are
   * still checked against what the project authors.
   */
  url?: string;
  /**
   * A space module to hold the pages to instead of the project's — what that other server serves, an agent's page —
   * authored in a process of its own.
   */
  space?: string;
}

/** One problem of a page, as data: what an agent branches on and points at, beside the sentence a person reads. */
export interface CheckIssue {
  code:
    | PageIssue['code']
    | DataIssueCode
    | 'no-answer'
    | 'no-page'
    | 'flow-failed'
    | 'not-server-rendered'
    | 'not-signed-in'
    | 'redirected'
    | 'page-status'
    | 'expected-text'
    | 'label-wraps'
    | 'fixed-ground'
    | 'flush-edge';
  message: string;
  /** The space's element it is about, by id — absent for one about the page as a whole. */
  elementId?: string;
  /** A `label-wraps` finding's label, as the page shows it: what the original's own wrapping is compared with. */
  label?: string;
  /** The width it was found at, so a list of every width's issues still says where each one is. */
  width: number;
}

export interface CheckReport {
  path: string;
  width: number;
  /** The theme it was painted in, when one was asked for. */
  scheme?: Scheme;
  ok: boolean;
  /** The elements the space owes this page that were looked for — 0 for a space that is not in the project. */
  checked: number;
  /** The problems as sentences — each `issues` entry's `message`. */
  problems: string[];
  issues: CheckIssue[];
  /** Owed, and hidden at this width by a breakpoint on purpose: looked at, and not a problem. */
  hiddenAtWidth: string[];
  /** Owed containers with nothing in them and no size: a shell another part fills — not a problem, said. */
  empty: string[];
  /** Owed controls out of use on purpose — transparent and taking no press: an arrow at its end. Said, not a problem. */
  outOfUse: string[];
  /** Checked in a task's copy: findings on elements other tasks write, said and failing nothing (`apart.ts`). */
  apart?: string[];
  /** In a run that keeps a reference: labels wrapped as the original wraps them, said and failing nothing (`apart.ts`). */
  asTheOriginal?: string[];
  consoleErrors: string[];
  failedRequests: string[];
  /** Whether the page had its dev tools on, which is what flows, state and elements are read from. */
  devTools: boolean;
  /** Every list, by id — fed by a provider, or its rows written out and on the page: how many it draws, how many it has. */
  lists: Record<string, ListRows>;
  /** With `--expect`: each expectation the page met, as `<id>~<text>` — said, so a pass is seen to be checked. */
  expected?: string[];
  /**
   * The images their host held back — answered 429 or 503, a connection let go or never answered, or dropped while it
   * answered the rest — its limit, met by checks asking at once: not the page's.
   */
  throttled?: string[];
  /** Console errors of a document embedded in the page (an iframe's — a video player), by its origin: not the space's. */
  fromEmbeds?: string[];
  /** With `--ssr`: the elements the page has once hydrated that the server's HTML did not — none of them in a server provider. */
  browserOnly?: string[];
  state?: unknown;
  sources?: Record<string, unknown>;
  /**
   * With `--element`, by id: what each reads and holds, as the dev tools have it, and how its classes meet on it at rest
   * at this width — `styles: null` when it is not on the page.
   */
  elements?: Record<string, { read: unknown; styles: ElementStyles | { unread: string } }>;
  /** With `--click`: what clicking the element changed. */
  clicked?: ClickReport;
  /**
   * The page was sent with status 404, as it should be: the space's page for an address nothing answers, or one whose
   * server provider said its answer is nothing (`notFound`).
   */
  notFound?: true;
  /**
   * What the server failed to answer the first time the page was looked at — a service of somebody else's having a bad
   * second — when it was looked at once more: this report is that second look.
   */
  retriedAfter?: string[];
}

/** The requests a server failed (`5xx`): what can pass by itself, unlike a `4xx`, which fails the same way again. */
export const serverErrors = (report: CheckReport): string[] =>
  report.failedRequests.filter(request => /^5\d\d /.test(request));

/** What a page is, as far as a click can change it: where it is, how far each part is scrolled, what shows. */
export interface PageMoment {
  url: string;
  /** How far down the page and each scrolled element is, by element id (`page` for the document itself). */
  scrolls: Record<string, number>;
  /** The elements the browser draws — shown, wherever the page is scrolled — by id. */
  shown: string[];
  /**
   * What the page says to the visitor outside its elements — a notification, an alert (`role="alert"`, `"status"`) —
   * by its words: a toast is drawn by the SDK, not by an element of the space, and is a change all the same.
   */
  said: string[];
}

/** What a click changed — each kind of change, said; none at all is said too. */
export interface ClickReport {
  element: string;
  /** The pointer was put over it, not clicked: its look is what changes most. */
  hovered?: true;
  /** Not done at this width, and why: a phone's width has no pointer to hover with. */
  skipped?: string;
  /** The fields filled before it, each with what was put in it. */
  filled?: string[];
  /** What filling them changed by itself, before the click: a field that acts as it is typed in. */
  fillChanges?: string[];
  /** The element could not be clicked: not on the page, hidden, covered. */
  problem?: string;
  changes: string[];
  /** The flows the click ran that failed, as the dev tools tell them. */
  failed: string[];
}

/** How an element's classes meet on it: the properties more than one sets, and the classes that change nothing. */
export interface ElementStyles {
  contested: ContestedStyle[];
  /**
   * The classes it wears that change nothing on it here: every property each sets stays as it is without it. A class
   * that changes even one property is never here — what it shares with another is said of that property alone.
   */
  inert: { className: string; properties: number }[];
  /**
   * The other elements of the space each of its classes is on: what changing the class itself — its rules, not this
   * element's `class` — changes too.
   */
  wornBy: Record<string, string[]>;
}

/** A property more than one of an element's classes sets, at rest: what each says, and which one the page shows. */
export interface ContestedStyle {
  property: string;
  declared: { className: string; value: string }[];
  /** The value the page shows. */
  shown: string;
  /** The class it is shown from — the one whose removal changes it; absent when they all say the same. */
  winner?: string;
}

/**
 * A list's rows: `rendered` is how many the page draws — `null` when the list is not on the page — and `source` how many
 * its source holds, before the binding's transformers, so a list that filters or slices them draws fewer; `null` when
 * it reads nothing.
 */
export interface ListRows {
  rendered: number | null;
  source: number | null;
  /**
   * A list drawn more than once — inside the row of another list, or of a component placed twice — its rows in each
   * copy: `rendered` is then all of them, and each copy filters its own share of the source.
   */
  copies?: number[];
}

/**
 * What `--click` is asked: the element, and the fields filled before it. Without an element, the fields filled are the
 * interaction — a search box, a filter that answers to typing — and what they changed is said.
 */
/** What `--expect <id>~<text>` asks: the element shows the text, as the page was left — a check an acceptance can run. */
export interface Expectation {
  element: string;
  text: string;
  /** The one page of those checked it is about; every one when left out. */
  path?: string;
}

/** What a check reads of the page beyond its issues, when asked: its state and sources, and elements by id. */
export interface CheckAsk {
  state: boolean;
  elements: readonly string[];
  /** `--status 404`: the status the page is meant to be sent with — a page for an address nothing answers, checked. */
  status?: number;
  /**
   * `--redirects-to /sign-in`: the page is meant to send this visitor there — checked by landing there, and what
   * landed is checked as the page (its `--expect` too). encore's settings: a guest sent to sign in failed every check.
   */
  redirectsTo?: string;
}

export interface ClickAsk {
  element?: string;
  fill: readonly FieldFill[];
  /** The pointer put over the element, not a click on it. */
  hover?: true;
}
