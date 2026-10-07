/**
 * The states a selector can react to — one list, read by the type, the style editor, the event schema and authoring.
 *
 * It used to be written out in each of those, and the copies drifted: the editor's `checked` and `visited` options had
 * their label and value swapped, so choosing one stored a state nothing else recognised.
 *
 * `focus-visible` is the focus ring a keyboard user needs and a mouse user does not; `focus-within` dresses a
 * container while anything inside it has focus — a field wrapper around its input.
 *
 * `current` is the chosen one of a set: the link to the page being shown (`aria-current`), the option pressed in a group
 * of toggles (`aria-pressed`), the selected tab (`aria-selected`). The element says so itself — what a screen reader
 * announces too — so a header written once in a layout marks the right item on every page, and a theme switch its
 * chosen scheme, which a class chosen per page could not.
 *
 * `expanded` is the control that opens a panel while the panel is open — a dropdown's trigger, an accordion's header, a
 * menu button (`aria-expanded`). The control says so itself, as the chosen one of a set does.
 *
 * `hidden` is not a pseudo-class: it is how an element looks while its `visible` says no — where it goes as it hides,
 * and where it comes from as it shows. With a transition on the class (`display` among what it transitions, and
 * `transition-behavior: allow-discrete`), a panel fades or slides in and out instead of blinking.
 *
 * `first`, `last`, `odd` and `even` are where the element sits among its siblings — the row of a list that has no
 * divider above it, the alternate rows of a table. They count every sibling, as `:nth-child` does.
 */
export const STYLE_STATES = [
  'hover',
  'focus',
  'focus-visible',
  'focus-within',
  'active',
  'disabled',
  'checked',
  'visited',
  'current',
  'expanded',
  'hidden',
  'first',
  'last',
  'odd',
  'even'
] as const;

/** What the SDK puts on an element whose `visible` says no: `display: none`, and what the `hidden` state selects. */
export const HIDDEN_CLASS = 'plitzi-component--hidden';

export const STYLE_STATE_LABELS: Record<(typeof STYLE_STATES)[number], string> = {
  hover: 'Hover',
  focus: 'Focus',
  'focus-visible': 'Focus visible',
  'focus-within': 'Focus within',
  active: 'Active',
  disabled: 'Disabled',
  checked: 'Checked',
  visited: 'Visited',
  current: 'Current',
  expanded: 'Expanded',
  hidden: 'Hidden',
  first: 'First child',
  last: 'Last child',
  odd: 'Odd child',
  even: 'Even child'
};

/**
 * Where each state is written in a rule, which is the order they win in.
 *
 * Every state weighs the same, so where two apply at once — hovered while pressed, hovered while disabled — the one
 * written later wins. This is the order browsers' own stylesheets and the CSS frameworks settle on: `visited` under
 * `hover` (LVHA), `hover` under `focus`, `focus` under `active` so a press always shows, and `disabled` last so a
 * control that cannot be used never answers the pointer. `current` and `expanded` sit with `checked`, under `hover`:
 * the chosen item and the open trigger still answer the pointer. `hidden` after all of them: an element on its way out
 * is leaving, however it is pointed at. Where the element sits comes first of all — `odd`/`even`, then `first`/`last`,
 * the particular over the general — so anything that happens to an element shows over where it is. It is not the order
 * the editor offers them in, which puts the common ones first.
 *
 * `current` weighs more than the others whatever its place (see {@link CURRENT_SELECTOR}), so the chosen item keeps its
 * look under the pointer too.
 */
const STYLE_STATE_CASCADE: Record<(typeof STYLE_STATES)[number], number> = {
  odd: 0,
  even: 1,
  first: 2,
  last: 3,
  visited: 4,
  checked: 5,
  current: 6,
  expanded: 7,
  'focus-within': 8,
  hover: 9,
  focus: 10,
  'focus-visible': 11,
  active: 12,
  disabled: 13,
  hidden: 14
};

export const isKnownState = (state: string): state is (typeof STYLE_STATES)[number] =>
  Object.hasOwn(STYLE_STATE_CASCADE, state);

const cascadeRank = (state: string): number => (isKnownState(state) ? STYLE_STATE_CASCADE[state] : STYLE_STATES.length);

/**
 * A rule's states in the order they have to be written for the right one to win, whatever order they were added in.
 * A state outside the list keeps its place after the known ones.
 */
export const inCascadeOrder = <T>(states: Record<string, T>): [string, T][] =>
  Object.entries(states).sort(([a], [b]) => cascadeRank(a) - cascadeRank(b));

/**
 * What the `current` state selects: whatever says it is the chosen one of its set — a link to the page being shown or
 * any other `aria-current` but `false`, a pressed toggle, a selected tab, and the tab panel on show (the SDK hides the
 * others with `hidden`). `aria-pressed="false"` on the options not chosen is what keeps them out.
 *
 * Its heaviest alternative weighs two attributes, so a class's `current` (0,3,0) wins over its `hover` (0,2,0) wherever
 * they are written: a new alternative must weigh no more than that, or every `current` rule gets heavier with it.
 */
export const CURRENT_SELECTOR =
  ':is([aria-current]:not([aria-current="false"]),[aria-pressed="true"],[aria-selected="true"],[role="tabpanel"]:not([hidden]))';

/** What the `expanded` state selects: the control whose panel is open. */
export const EXPANDED_SELECTOR = '[aria-expanded="true"]';

/** The states that are not a pseudo-class of the same name, and what each is written as. */
const STATE_SELECTORS: Partial<Record<(typeof STYLE_STATES)[number], string>> = {
  current: CURRENT_SELECTOR,
  expanded: EXPANDED_SELECTOR,
  hidden: `.${HIDDEN_CLASS}`,
  first: ':first-child',
  last: ':last-child',
  odd: ':nth-child(odd)',
  even: ':nth-child(even)'
};

/**
 * How a state is written after the selector it modifies: its pseudo-class — or, for `hidden`, the class that hides; for
 * `current` and `expanded`, the attributes the element carries; for where it sits, the structural pseudo-class.
 */
export const stateSuffix = (state: string): string =>
  (isKnownState(state) ? STATE_SELECTORS[state] : undefined) ?? `:${state}`;

/**
 * Whether a state is also where an element starts from as it appears (`@starting-style`): `hidden` is — a panel that
 * fades out to nothing fades in from it — and every pseudo-class is not.
 */
export const isStartingState = (state: string): boolean => state === 'hidden';

/**
 * The `ancestors` key of the element right around this one — its parent — whatever class it wears, or none.
 *
 * What a closed component's part reacts to: the icon inside a button turning while the button is `expanded`, a label
 * lit while its link is `current`. Only the parent, never "any ancestor": every ancestor of a hovered element is
 * hovered too, up to `<body>`, so a condition on "an ancestor in a state" without naming it would always hold. Written
 * `:where(:state) > &` — one step up, no `:has()`. It takes states only: "inside a parent" with no state is always.
 * Authored as `parent`; a class name can never be `>`, so the key cannot meet a class.
 */
export const PARENT_ANCESTOR = '>';

export const isParentAncestor = (ancestor: string): boolean => ancestor === PARENT_ANCESTOR;
