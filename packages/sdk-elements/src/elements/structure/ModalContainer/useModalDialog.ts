import { useEffect, useEffectEvent } from 'react';

import type { RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/** What Tab can land on: a control hidden by a variant or a `visible` rule is still in the DOM, and skipped. */
const focusableIn = (panel: HTMLElement): HTMLElement[] =>
  [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(element =>
    typeof element.checkVisibility === 'function' ? element.checkVisibility() : true
  );

export type UseModalDialogProps = {
  /** The box that holds the dialog's content: what takes the focus, and what the focus is kept inside. */
  panelRef: RefObject<HTMLElement | null>;
  /** Shown, and on a rendered page — never in the builder, where the modal is something being edited. */
  open: boolean;
  /** What Escape does: the same as the close button. */
  onClose: () => void;
};

/**
 * What `aria-modal` promises, kept: while a modal is open the keyboard lives inside it.
 *
 * - **The focus moves in** as it opens — to the panel itself, so a screen reader reads its name first; a control inside
 *   that took the focus on its own (`autoFocus`) keeps it.
 * - **Tab and Shift+Tab go round** the panel's controls instead of walking out into the page behind it.
 * - **Escape closes it**, as its close button does.
 * - **The focus goes back** to whatever had it before, so a person — or a browser agent — carries on where they were.
 */
const useModalDialog = ({ panelRef, open, onClose }: UseModalDialogProps): void => {
  const close = useEffectEvent(onClose);

  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) {
      return undefined;
    }

    const previous = panel.ownerDocument.activeElement;
    if (!panel.contains(previous)) {
      panel.focus({ preventScroll: true });
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        close();

        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = focusableIn(panel);
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus({ preventScroll: true });

        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = panel.ownerDocument.activeElement;
      if (event.shiftKey && (active === first || active === panel || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    const view = panel.ownerDocument.defaultView;
    view?.addEventListener('keydown', handleKeyDown);

    return () => {
      view?.removeEventListener('keydown', handleKeyDown);
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [open, panelRef]);
};

export default useModalDialog;
