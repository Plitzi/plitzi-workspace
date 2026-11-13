import clsx from 'clsx';
import { useCallback, useState } from 'react';

import { MUTED, titleOfCode } from '../../helpers';
import IssueFix from '../IssueFix';

import type { ReactNode } from 'react';

export type CodeGroupProps = {
  code: string;
  /** How many entries it holds. */
  count: number;
  /** What to do, said once for every entry: the row of the code. */
  fix: string | null;
  fixLabel?: string;
  /** Said beside the count when folded — what taking it saves. */
  aside?: string;
  /** The icon of the list it is in, in its colour. */
  icon: string;
  tone: string;
  /** Unfolded from the start: a list with a single code has nothing to choose between. */
  defaultOpen?: boolean;
  children: ReactNode;
};

/**
 * The entries of one code, folded to a line — its name, how many, what they save — so a long list reads as the few
 * kinds of thing it is. Unfolded, it says what to do once and then each entry.
 */
const CodeGroup = ({
  code,
  count,
  fix,
  fixLabel,
  aside,
  icon,
  tone,
  defaultOpen = false,
  children
}: CodeGroupProps) => {
  const [open, setOpen] = useState(defaultOpen);

  const handleToggle = useCallback(() => setOpen(value => !value), []);

  return (
    <li className="rounded-md border border-zinc-200 dark:border-zinc-700">
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
        aria-expanded={open}
        onClick={handleToggle}
      >
        <i className={clsx('fa-solid w-3 text-[10px]', MUTED, open ? 'fa-chevron-down' : 'fa-chevron-right')} />
        <i className={clsx('fa-solid text-xs', icon, tone)} />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-800 dark:text-zinc-100" title={code}>
          {titleOfCode(code)}
        </span>
        {aside && <span className={clsx('shrink-0 text-[11px]', MUTED)}>{aside}</span>}
        <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 text-[11px] font-medium text-zinc-600 tabular-nums dark:bg-zinc-800 dark:text-zinc-300">
          {count}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-1 border-t border-zinc-200 px-3 pt-2 pb-1 dark:border-zinc-700">
          {fix && <IssueFix fix={fix} label={fixLabel} />}
          <ul className="flex flex-col">{children}</ul>
        </div>
      )}
    </li>
  );
};

export default CodeGroup;
