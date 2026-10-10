import { useCallback, useEffect, useRef } from 'react';

import type { MouseEvent, RefObject } from 'react';

const CONTROLS = 'button, a[href], input, select, textarea, [role="button"]';

/**
 * The control a person opens the menu with: the first one in the dropdown that is not inside its popup. Looked for
 * from the dropdown, not from the popup — the open popup is drawn at the space's root, outside it.
 */
const triggerOf = (root: HTMLElement | null | undefined, popup: HTMLElement | null): HTMLElement | undefined =>
  root ? [...root.querySelectorAll<HTMLElement>(CONTROLS)].find(control => !popup?.contains(control)) : undefined;

export type UseDropdownTriggerProps = {
  /** The dropdown's own element, where its trigger is. */
  rootRef?: RefObject<HTMLElement | null>;
  popupRef: RefObject<HTMLElement | null>;
  open: boolean;
  /** Where the popup is drawn; until it is known the popup is hidden, and nothing in it can take the focus. */
  positioned: boolean;
  /** Off in the builder, where a dropdown is something being edited. */
  enabled: boolean;
};

/**
 * What a dropdown tells assistive technology about the control that opens it, and where the keyboard goes.
 *
 * - **The trigger says it opens something** (`aria-haspopup`) **and whether it is open** (`aria-expanded`). The trigger
 *   is the author's own button, so the attributes are written on it rather than rendered.
 * - **Opened from the keyboard, the focus moves to the popup's first control** — the popup can come before the trigger
 *   in the page, where Tab would never reach it. Opened with a pointer, the focus stays: nobody asked for it to move.
 * - **Closed while the focus is inside, the focus goes back to the trigger**, so Escape leaves a person where they were
 *   instead of on a control that has just been hidden.
 *
 * A dropdown with no control outside its popup has none of this: nothing a keyboard can reach opens it
 * (`dropdown-without-control`, in the linter).
 *
 * @returns what the dropdown's own click handler calls first, to learn whether a keyboard pressed the trigger.
 */
const useDropdownTrigger = ({
  rootRef,
  popupRef,
  open,
  positioned,
  enabled
}: UseDropdownTriggerProps): ((event: MouseEvent) => void) => {
  const fromKeyboard = useRef(false);
  const wasOpen = useRef(open);

  // A click a keyboard makes (Enter or Space on a button) carries no pointer, and says so with `detail` 0.
  const noteClick = useCallback((event: MouseEvent) => {
    fromKeyboard.current = event.detail === 0;
  }, []);

  useEffect(() => {
    const trigger = enabled ? triggerOf(rootRef?.current, popupRef.current) : undefined;
    if (!trigger) {
      return;
    }

    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', String(open));
  });

  useEffect(() => {
    const popup = popupRef.current;
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    if (!enabled || !popup) {
      return;
    }

    if (closed && popup.contains(popup.ownerDocument.activeElement)) {
      triggerOf(rootRef?.current, popup)?.focus({ preventScroll: true });

      return;
    }

    if (open && positioned && fromKeyboard.current && !popup.contains(popup.ownerDocument.activeElement)) {
      fromKeyboard.current = false;
      popup.querySelector<HTMLElement>(CONTROLS)?.focus({ preventScroll: true });
    }
  }, [enabled, open, positioned, popupRef, rootRef]);

  return noteClick;
};

export default useDropdownTrigger;
