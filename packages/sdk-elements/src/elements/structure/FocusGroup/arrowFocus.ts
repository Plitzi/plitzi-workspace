/** What a press of the arrow keys can move the focus to: the controls a pointer would press. */
const CONTROLS =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]):not(input):not(textarea):not(select)';

/** Where somebody types: the arrows there move the caret, except down, which leaves for the controls under it. */
const FIELDS = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea';

const ARROW_KEYS = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'] as const;

export type ArrowKey = (typeof ARROW_KEYS)[number];

export const isArrowKey = (key: string): key is ArrowKey => (ARROW_KEYS as readonly string[]).includes(key);

/** On screen: a control that is hidden, or inside something hidden, is no stop. */
const shown = (element: Element): boolean => element.getClientRects().length > 0;

/** The list a control belongs to — the group ←/→ move between — or the control itself when it is in none. */
const groupOf = (control: Element, container: Element): Element => {
  const list = control.parentElement?.closest('ul, ol, [role="listbox"], [role="group"]');

  return list && container.contains(list) ? list : control;
};

/**
 * Where an arrow key moves the focus inside `container`, from `from` (what holds it), or nothing when it stays.
 *
 * ↑ and ↓ go through the controls in the order they are read; ←/→ to the first control of the next or the previous
 * list; Home and End to the first and the last. From a text field, ↓ goes to the first control and the rest are the
 * field's own (the caret); ↑ from the first control goes back to the field.
 */
export const arrowTarget = (container: Element, from: Element, key: ArrowKey): HTMLElement | undefined => {
  const field = from.matches(FIELDS) ? from : undefined;
  const controls = [...container.querySelectorAll<HTMLElement>(CONTROLS)].filter(shown);
  if (controls.length === 0) {
    return undefined;
  }

  if (field) {
    return key === 'ArrowDown' ? controls[0] : undefined;
  }

  const at = controls.indexOf(from as HTMLElement);
  if (at === -1) {
    return undefined;
  }

  switch (key) {
    case 'ArrowDown':
      return controls[at + 1];
    case 'ArrowUp':
      return at > 0 ? controls[at - 1] : [...container.querySelectorAll<HTMLElement>(FIELDS)].find(shown);
    case 'Home':
      return controls[0];
    case 'End':
      return controls[controls.length - 1];
    case 'ArrowRight':
    case 'ArrowLeft': {
      const groups = [...new Set(controls.map(control => groupOf(control, container)))];
      const next = groups.indexOf(groupOf(from, container)) + (key === 'ArrowRight' ? 1 : -1);
      if (next < 0 || next >= groups.length) {
        return undefined;
      }

      return controls.find(control => groupOf(control, container) === groups[next]);
    }
  }
};
