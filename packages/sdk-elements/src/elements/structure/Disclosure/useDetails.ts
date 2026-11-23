import { useCallback, useEffect, useRef } from 'react';

import { useCommonStore } from '@plitzi/sdk-shared/store';

import type { KeyboardEvent, MouseEvent, RefObject, SyntheticEvent } from 'react';

export type UseDetailsProps = {
  /** The `<details>` itself. */
  ref: RefObject<HTMLElement | null>;
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Edited in the builder: what it holds stays there to edit, and its summary selects rather than closes it. */
  editing: boolean;
  /** Closed by a press anywhere outside it — a menu. */
  closeOnClickOutside: boolean;
  /** Closed when the page changes — a menu in a layout, which stays on the screen from one page to the next. */
  closeOnNavigate: boolean;
};

/** Its own summary — the first child, the one the browser opens it with — found from the `<details>`. */
const summaryOf = (details: HTMLElement | null): HTMLElement | null =>
  details?.querySelector<HTMLElement>(':scope > summary') ?? null;

/**
 * What a `<details>` that opens and closes something needs besides the browser: its state kept as the browser opens and
 * closes it (its summary, find-in-page, another of its group), Escape — a `<details>` has none — giving the focus back
 * to the summary, a press outside and a new page closing it, and the summary inert while it is edited in the builder.
 * Shared by the disclosure and the account menu, which is one.
 *
 * @returns the handlers the `<details>` takes.
 */
const useDetails = ({ ref, open, setOpen, editing, closeOnClickOutside, closeOnNavigate }: UseDetailsProps) => {
  const [href] = useCommonStore('navigation.href');

  const onToggle = useCallback(
    (event: SyntheticEvent<HTMLElement>) => {
      const next = event.currentTarget instanceof HTMLDetailsElement && event.currentTarget.open;
      if (!editing && next !== open) {
        setOpen(next);
      }
    },
    [editing, open, setOpen]
  );

  const onClickCapture = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (editing && event.target instanceof Element && summaryOf(event.currentTarget)?.contains(event.target)) {
        event.preventDefault();
      }
    },
    [editing]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== 'Escape' || editing || !open) {
        return;
      }

      event.stopPropagation();
      setOpen(false);
      summaryOf(event.currentTarget)?.focus({ preventScroll: true });
    },
    [editing, open, setOpen]
  );

  useEffect(() => {
    const details = ref.current;
    if (!details || editing || !open || !closeOnClickOutside) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !details.contains(event.target)) {
        setOpen(false);
      }
    };
    const document = details.ownerDocument;
    document.addEventListener('pointerdown', handlePointerDown);

    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [ref, editing, open, closeOnClickOutside, setOpen]);

  const seenHref = useRef(href);
  useEffect(() => {
    if (seenHref.current === href) {
      return;
    }

    seenHref.current = href;
    if (closeOnNavigate && open) {
      setOpen(false);
    }
  }, [href, closeOnNavigate, open, setOpen]);

  return { onToggle, onClickCapture, onKeyDown };
};

export default useDetails;
