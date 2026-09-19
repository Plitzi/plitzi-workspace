/**
 * The states a selector can react to — one list, read by the type, the style editor, the event schema and authoring.
 *
 * It used to be written out in each of those, and the copies drifted: the editor's `checked` and `visited` options had
 * their label and value swapped, so choosing one stored a state nothing else recognised.
 *
 * `focus-visible` is the focus ring a keyboard user needs and a mouse user does not; `focus-within` dresses a
 * container while anything inside it has focus — a field wrapper around its input.
 */
export const STYLE_STATES = [
  'hover',
  'focus',
  'focus-visible',
  'focus-within',
  'active',
  'disabled',
  'checked',
  'visited'
] as const;

export const STYLE_STATE_LABELS: Record<(typeof STYLE_STATES)[number], string> = {
  hover: 'Hover',
  focus: 'Focus',
  'focus-visible': 'Focus visible',
  'focus-within': 'Focus within',
  active: 'Active',
  disabled: 'Disabled',
  checked: 'Checked',
  visited: 'Visited'
};

/**
 * Where each state is written in a rule, which is the order they win in.
 *
 * Every state weighs the same, so where two apply at once — hovered while pressed, hovered while disabled — the one
 * written later wins. This is the order browsers' own stylesheets and the CSS frameworks settle on: `visited` under
 * `hover` (LVHA), `hover` under `focus`, `focus` under `active` so a press always shows, and `disabled` last so a
 * control that cannot be used never answers the pointer. It is not the order the editor offers them in, which puts
 * the common ones first.
 */
const STYLE_STATE_CASCADE: Record<(typeof STYLE_STATES)[number], number> = {
  visited: 0,
  checked: 1,
  'focus-within': 2,
  hover: 3,
  focus: 4,
  'focus-visible': 5,
  active: 6,
  disabled: 7
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
