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
 * `hidden` is not a pseudo-class: it is how an element looks while its `visible` says no — where it goes as it hides,
 * and where it comes from as it shows. With a transition on the class (`display` among what it transitions, and
 * `transition-behavior: allow-discrete`), a panel fades or slides in and out instead of blinking.
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
  'hidden'
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
  hidden: 'Hidden'
};

/**
 * Where each state is written in a rule, which is the order they win in.
 *
 * Every state weighs the same, so where two apply at once — hovered while pressed, hovered while disabled — the one
 * written later wins. This is the order browsers' own stylesheets and the CSS frameworks settle on: `visited` under
 * `hover` (LVHA), `hover` under `focus`, `focus` under `active` so a press always shows, and `disabled` last so a
 * control that cannot be used never answers the pointer. `current` sits with `checked`, under `hover`: the chosen item
 * still answers the pointer. `hidden` after all of them: an element on its way out is
 * leaving, however it is pointed at. It is not the order the editor offers them in, which puts the common ones first.
 */
const STYLE_STATE_CASCADE: Record<(typeof STYLE_STATES)[number], number> = {
  visited: 0,
  checked: 1,
  current: 2,
  'focus-within': 3,
  hover: 4,
  focus: 5,
  'focus-visible': 6,
  active: 7,
  disabled: 8,
  hidden: 9
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
 * any other `aria-current` but `false`, a pressed toggle, a selected tab. `aria-pressed="false"` on the options not
 * chosen is what keeps them out.
 */
export const CURRENT_SELECTOR =
  ':is([aria-current]:not([aria-current="false"]),[aria-pressed="true"],[aria-selected="true"])';

/**
 * How a state is written after the selector it modifies: its pseudo-class — or, for `hidden`, the class that hides, and
 * for `current`, the attributes the chosen one of a set carries.
 */
export const stateSuffix = (state: string): string => {
  if (state === 'hidden') {
    return `.${HIDDEN_CLASS}`;
  }

  return state === 'current' ? CURRENT_SELECTOR : `:${state}`;
};

/**
 * Whether a state is also where an element starts from as it appears (`@starting-style`): `hidden` is — a panel that
 * fades out to nothing fades in from it — and every pseudo-class is not.
 */
export const isStartingState = (state: string): boolean => state === 'hidden';
