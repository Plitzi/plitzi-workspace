/**
 * A space's tests, kept in its document beside its pages — written in the builder, by code or by an agent —
 * and run against the document they are kept in: a snapshot and a publish need them passing.
 *
 * Two kinds, apart on purpose:
 *
 * - **unit**: one element of the document resolved for a state and data, with no browser — what its bindings, templates
 *   and rules make of it. Milliseconds.
 * - **e2e**: a page opened in a browser, a visitor's steps, and what must hold as they go — the flows.
 */
export interface SpaceTests {
  unit?: UnitTest[];
  e2e?: E2eTest[];
  /** Who the journeys may play as, signed in: declared here alone — see `E2eAccount`. */
  accounts?: E2eAccount[];
}

/**
 * Somebody signed in, as the space's journeys play them: declared in the tests alone — no account of the platform's,
 * no password. A journey that plays `as` one shows its pages that visitor: the auth source holds these details and a
 * token no server takes (`test:<id>`), `can()` answers by these permissions, a page for signed-in visitors opens. The
 * server's API does not know it: what a page asks the API it asks as a guest — a journey with an account reads and
 * moves, it never writes.
 */
export interface E2eAccount {
  /** What the journeys name it by, and its username on the page: letters, digits, `-` and `_`. */
  id: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
}

/** What a unit test resolves its element for. */
export interface UnitGiven {
  /** The space's state — what `state.<key>` reads. */
  state?: Record<string, unknown>;
  /**
   * Every other source, by its name: an element's (`list_bins` — a list's row is `{ item, index }` —,
   * `apiContainer_feed`) or a global's (`navigation`, `auth`, `theme`, `flags`, `variables`, `host`). The space's
   * `computed` values are worked out from them and the state.
   */
  sources?: Record<string, unknown>;
}

/** What must hold of the element a unit test resolves. */
export type UnitExpectation =
  /** It shows: neither it nor an element around it hidden. */
  | { kind: 'visible'; value: boolean }
  /** An attribute, bindings and templates applied: `content`, `href`, `items`. */
  | { kind: 'attribute'; name: string; value: unknown }
  /** A property its style bindings write, as CSS names it: `height`, `background-color`. */
  | { kind: 'style'; property: string; value: string }
  /** The variant of one of its classes: `pr-rung` is `current`. An empty value is its base. */
  | { kind: 'variant'; className: string; value: string }
  /** A key of its initial state, bindings applied: `visibility`, `checked`. */
  | { kind: 'state'; key: string; value: unknown };

export interface UnitTest {
  id: string;
  title: string;
  /** The element of a page it resolves, by id. */
  element: string;
  given?: UnitGiven;
  expect: UnitExpectation[];
}

/**
 * An element a step or an expectation names: its id, and for one a list draws more than once, which copy — `bin-bar:3`
 * (the third, from one), `bin-bar:last`.
 */
export type E2eTarget = string;

/** What a visitor does, one step of an e2e test. */
export type E2eAction =
  | { kind: 'click'; element: E2eTarget }
  | { kind: 'hover'; element: E2eTarget }
  | { kind: 'type'; element: E2eTarget; text: string }
  /** A key or a combination, as a keyboard names it: `Enter`, `Meta+k`. */
  | { kind: 'press'; key: string }
  | { kind: 'scroll'; element: E2eTarget; dx?: number; dy?: number }
  | { kind: 'drag'; element: E2eTarget; dx: number; dy: number }
  /** Until the element shows — at most `ms` (5 s). */
  | { kind: 'waitFor'; element: E2eTarget; ms?: number }
  /** A path of the space's own: `/menu`. */
  | { kind: 'goto'; path: string }
  | { kind: 'back' }
  | { kind: 'reload' }
  /** The page's state set as a flow would set it: a case reached without its steps. */
  | { kind: 'setState'; key: string; value: unknown }
  /** A source's value put on the page: `apiContainer_feed.items`. */
  | { kind: 'setSource'; path: string; value: unknown }
  /** The page's held clock moved on, in ms. */
  | { kind: 'tick'; ms: number };

/** What must hold of the page, checked where it stands among the steps. */
export type E2eExpectation =
  | { kind: 'expectShown'; element: E2eTarget }
  | { kind: 'expectHidden'; element: E2eTarget }
  /** Its words hold the text — or are it, `exact`. */
  | { kind: 'expectText'; element: E2eTarget; text: string; exact?: boolean }
  | { kind: 'expectState'; key: string; value: unknown }
  | { kind: 'expectAttribute'; element: E2eTarget; name: string; value: string }
  /** A computed property, as CSS names it — or at least (`>=`) or at most (`<=`) a number of it. */
  | { kind: 'expectStyle'; element: E2eTarget; property: string; value: string; at?: '>=' | '<=' }
  /** Where two elements stand: `activity.bottom + 8 <= legend.top`. */
  | { kind: 'expectPosition'; relation: string }
  /**
   * An element check of the space (`tests.unit`, by id) holds for the page as the journey left it: its element resolved
   * for the page's state and sources now — not the check's own `given.state` — with the sources the check names itself
   * (a list's row) laid over them. One check of the logic, held at the moment a whole flow reaches it.
   */
  | { kind: 'expectCheck'; check: string };

export type E2eStep = E2eAction | E2eExpectation;

export interface E2eTest {
  id: string;
  title: string;
  /** The path it opens: `/menu`, `/r/night-drive`. */
  page: string;
  /** The window's width, in px: 1440 when left out. */
  width?: number;
  scheme?: 'light' | 'dark';
  /** The account it plays as, signed in (`accounts`, by id): a guest when left out. */
  as?: string;
  /**
   * Server actions answered by the test, by id: what they return, so the test reads the same data every time. An
   * action it does not name is answered by the space as for a visitor.
   */
  answers?: Record<string, Record<string, unknown>>;
  /** The page's clock, held from this instant (ISO, UTC): a page that writes the time reads the same every run. */
  clock?: string;
  /**
   * Where it starts: the page's state set as it opens, before the first step — a case reached without the steps that
   * lead to it (a basket already full, a visitor already past the first screen).
   */
  given?: { state: Record<string, unknown> };
  steps: E2eStep[];
}
