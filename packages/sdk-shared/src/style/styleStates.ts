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
