import clsx from 'clsx';
import { useCallback } from 'react';

import type { ContentKind } from './helpers';
import type { ReactNode } from 'react';

export type ContentOptionProps = {
  kind: ContentKind;
  chosen: boolean;
  title: string;
  detail: string;
  /** The plan that includes it, when the space's does not: shown, never chosen. */
  lockedBy?: string;
  /** What to fill in for it, under it while it is chosen. */
  children?: ReactNode;
  onChoose: (kind: ContentKind) => void;
};

/** One answer to what a domain should show: its words, and what it asks for once chosen. */
const ContentOption = ({ kind, chosen, title, detail, lockedBy, children, onChoose }: ContentOptionProps) => {
  const handleChoose = useCallback(() => onChoose(kind), [kind, onChoose]);

  return (
    <div
      className={clsx(
        'flex flex-col rounded-lg border transition-colors',
        chosen ? 'border-primary-500 bg-primary-500/5' : 'border-ui-line',
        lockedBy && 'opacity-60'
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={chosen}
        disabled={lockedBy !== undefined}
        className={clsx(
          'focus-visible:ring-primary-500 flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-left outline-none focus-visible:ring-2',
          !chosen && !lockedBy && 'hover:bg-ui-hover',
          lockedBy && 'cursor-not-allowed'
        )}
        onClick={handleChoose}
      >
        <span
          aria-hidden
          className={clsx(
            'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
            chosen ? 'border-primary-500' : 'border-ui-line'
          )}
        >
          {chosen && <span className="bg-primary-500 size-2 rounded-full" />}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-ui-fg flex items-center gap-1.5 text-sm font-medium">
            {title}
            {lockedBy && (
              <span className="text-ui-fg-subtle text-[11px] font-normal">
                <i className="fa-solid fa-lock mr-1" aria-hidden />
                {lockedBy}
              </span>
            )}
          </span>
          <span className="text-ui-fg-subtle text-xs">{detail}</span>
        </span>
      </button>
      {chosen && children && <div className="flex flex-col gap-3 px-3 pb-3 pl-9">{children}</div>}
    </div>
  );
};

export default ContentOption;
