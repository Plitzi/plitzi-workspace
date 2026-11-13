import ContainerFloating from '@plitzi/plitzi-ui/ContainerFloating';
import clsx from 'clsx';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

import type { MouseEvent, ReactNode } from 'react';

export type ValueListItemProps = {
  /** The item as CSS writes it, drawn in the row. */
  summary: string;
  /** What sits before the summary — a swatch of the shadow's color, the layer's preview. */
  preview?: ReactNode;
  /** The popover's title: what kind of item it edits. */
  title: string;
  /** What removing says it removes — "Remove shadow". */
  removeLabel: string;
  onRemove: () => void;
  /** The popover's controls. */
  children?: ReactNode;
};

/**
 * One item of a list property: a row that reads as the CSS it writes, a button that removes it, and the popover that
 * edits it — opened by the row, closed by its own button, by Escape or by a click outside.
 */
const ValueListItem = ({ summary, preview, title, removeLabel, onRemove, children }: ValueListItemProps) => {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Focus moves into the opened editor, so the keys typed next are its own — and Escape, which the popover closes on,
  // never reaches the canvas, where it deselects the element. A frame later: the popover mounts after this render.
  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = requestAnimationFrame(() => contentRef.current?.focus({ preventScroll: true }));

    return () => cancelAnimationFrame(frame);
  }, [open]);

  const handleToggle = useCallback(() => setOpen(state => !state), []);

  const handleClose = useCallback(() => setOpen(false), []);

  const handleRemove = useCallback(
    (e: MouseEvent) => {
      // The row opens the popover; removing must not open it on the way out.
      e.stopPropagation();
      e.preventDefault();
      onRemove();
    },
    [onRemove]
  );

  return (
    <ContainerFloating
      className="w-full min-w-0"
      closeOnClick={false}
      containerTopOffset={4}
      open={open}
      onOpenChange={setOpen}
    >
      <ContainerFloating.Trigger
        className={clsx(
          'group flex h-7 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md border px-2 text-xs transition-colors duration-150 select-none',
          {
            'border-primary-500/60 bg-primary-500/5 dark:border-primary-400/60 dark:bg-primary-400/10': open,
            'border-ui-line bg-ui-raised hover:border-ui-line-strong hover:bg-ui-hover': !open
          }
        )}
        onClick={handleToggle}
      >
        {preview}
        <span className="text-ui-fg min-w-0 grow truncate font-mono text-[11px]" title={summary}>
          {summary}
        </span>
        <button
          type="button"
          className="text-ui-fg-subtle group-hover:text-ui-fg flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded transition-colors duration-150 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
          title={removeLabel}
          aria-label={removeLabel}
          onClick={handleRemove}
        >
          <i className="fa-solid fa-xmark text-xs" />
        </button>
      </ContainerFloating.Trigger>
      <ContainerFloating.Content className="w-64">
        <div ref={contentRef} className="flex w-full flex-col outline-none" tabIndex={-1}>
          <div className="border-ui-line flex items-center justify-between gap-2 border-b px-3 py-2">
            <span className="text-ui-fg text-xs font-semibold">{title}</span>
            <button
              type="button"
              className="text-ui-fg-subtle hover:bg-ui-hover hover:text-ui-fg flex h-5 w-5 cursor-pointer items-center justify-center rounded"
              title="Close"
              aria-label="Close"
              onClick={handleClose}
            >
              <i className="fa-solid fa-xmark text-xs" />
            </button>
          </div>
          <div className="flex flex-col gap-3 p-3">{children}</div>
        </div>
      </ContainerFloating.Content>
    </ContainerFloating>
  );
};

export default memo(ValueListItem);
