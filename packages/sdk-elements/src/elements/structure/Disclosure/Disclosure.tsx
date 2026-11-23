import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { usePlitzi } from '@plitzi/sdk-shared/hooks';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import declaration from './declaration';
import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { InteractionCallback } from '@plitzi/sdk-shared';
import type { KeyboardEvent, MouseEvent, ReactNode, RefObject, SyntheticEvent } from 'react';

export type DisclosureProps = {
  ref?: RefObject<HTMLElement | null>;
  className?: string;
  children?: ReactNode;
  /** Whether what it holds is shown. Its summary opens and closes it, and so do the open/close/toggle steps. */
  open?: boolean;
  /**
   * Its group: of the disclosures with the same name, one is open at a time — an accordion. Empty, it opens and closes
   * on its own.
   */
  name?: string;
  /** Closed by a press anywhere outside it — a menu, a panel of filters; a question of a FAQ stays open. */
  closeOnClickOutside?: boolean;
  /** Closed when the page changes — a menu in a layout, which stays on the screen from one page to the next. */
  closeOnNavigate?: boolean;
};

/** Its state with what it holds shown or not, the rest kept: what every way of opening and closing it writes. */
const withOpen =
  (open: boolean) =>
  <S extends Record<string, unknown>>(state: S): S => ({ ...state, open });

/** Its own summary — the first child, the one the browser opens it with — found from the `<details>`. */
const summaryOf = (details: HTMLElement | null): HTMLElement | null =>
  details?.querySelector<HTMLElement>(':scope > summary') ?? null;

/**
 * What it holds, shown or not by its summary: a `<details>`, so it works as the page arrives — before the script, or
 * without one — the browser's find-in-page opens the one that holds what was found, a group (`name`) is an accordion
 * without a line of code, and what is closed is still in the page for a search engine to read.
 */
const Disclosure = ({
  ref: refProp,
  className = '',
  children,
  open = false,
  name = '',
  closeOnClickOutside = false,
  closeOnNavigate = true
}: DisclosureProps) => {
  const { setElementState } = useElement();
  const {
    settings: { previewMode }
  } = usePlitzi();
  const [href] = useCommonStore('navigation.href');
  const ownRef = useRef<HTMLElement | null>(null);
  const ref = refProp ?? ownRef;
  // Edited in the builder, what it holds is always there to edit, and its summary selects rather than closes it.
  const editing = !previewMode;

  const setOpen = useCallback((next: boolean) => setElementState(withOpen(next)), [setElementState]);

  // The browser opened or closed it — its summary pressed, find-in-page, another of its group opening.
  const handleToggle = useCallback(
    (event: SyntheticEvent<HTMLElement>) => {
      const next = event.currentTarget instanceof HTMLDetailsElement && event.currentTarget.open;
      if (!editing && next !== open) {
        setOpen(next);
      }
    },
    [editing, open, setOpen]
  );

  const handleClickCapture = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (editing && event.target instanceof Element && summaryOf(event.currentTarget)?.contains(event.target)) {
        event.preventDefault();
      }
    },
    [editing]
  );

  // Escape closes it — a `<details>` does not by itself — and leaves the focus on its summary, never on what just hid.
  const handleKeyDown = useCallback(
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

  const interactionCallbacks = useMemo<Record<string, InteractionCallback>>(
    () => ({
      openDisclosure: { ...declaration.callbacks.openDisclosure, callback: () => setOpen(true) },
      closeDisclosure: { ...declaration.callbacks.closeDisclosure, callback: () => setOpen(false) },
      toggleDisclosure: { ...declaration.callbacks.toggleDisclosure, callback: () => setOpen(!open) }
    }),
    [open, setOpen]
  );

  return (
    <RootElement
      tag="details"
      ref={ref}
      className={clsx('plitzi-component__disclosure', className)}
      open={editing || open}
      // Grouped only on the page: in the builder every one of a group stays open to be edited.
      name={name && !editing ? name : undefined}
      onToggle={handleToggle}
      onClickCapture={handleClickCapture}
      onKeyDown={handleKeyDown}
      interactionCallbacks={interactionCallbacks}
    >
      {children}
    </RootElement>
  );
};

export default withElement(Disclosure);

export { Disclosure };
