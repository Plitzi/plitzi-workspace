import { memo } from 'react';

import InspectorLabel from '../InspectorLabel';

import type { StyleCategory } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type ValueListProps = {
  label: string;
  keys: StyleCategory[];
  /** What the add button says it adds — "Add box shadow" — its tooltip and its name for a screen reader. */
  addLabel: string;
  onAdd: () => void;
  children?: ReactNode;
};

/**
 * A property that holds a list — shadows, transforms, transitions, filters: its label (which resets the whole list,
 * as any label does), a button that appends one, and a row per item.
 */
const ValueList = ({ label, keys, addLabel, onAdd, children }: ValueListProps) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center justify-between gap-2">
      <InspectorLabel keyValue={keys}>{label}</InspectorLabel>
      <button
        type="button"
        className="focus-visible:outline-primary-500 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition-colors duration-150 hover:bg-gray-100 hover:text-zinc-900 focus-visible:outline-2 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        title={addLabel}
        aria-label={addLabel}
        onClick={onAdd}
      >
        <i className="fa-solid fa-plus text-xs" />
      </button>
    </div>
    {children && <div className="flex flex-col gap-1">{children}</div>}
  </div>
);

export default memo(ValueList);
