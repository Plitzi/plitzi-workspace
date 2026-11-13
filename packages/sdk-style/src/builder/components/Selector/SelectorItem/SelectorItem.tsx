import Contenteditable from '@plitzi/plitzi-ui/ContentEditable';
import clsx from 'clsx';
import { useCallback, useState } from 'react';

import { selectorFormatter } from '../SelectorHelper';
import ItemOptions from './ItemOptions';

import type { SelectorValue } from '../Selector';
import type { TagType } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type SelectorItemProps = {
  className?: string;
  selector?: string;
  /**
   * What the chip reads as instead of the class's name, when the name says nothing to a person — a class the builder
   * named after its element (`container-2f16`) reads as the element's label. Double-clicking still edits the name.
   */
  label?: string;
  type?: TagType;
  editable?: boolean;
  active?: boolean;
  readOnly?: boolean;
  onClick?: (selector: SelectorValue) => void;
  onChange?: (selector: SelectorValue) => void;
  onAction?: (action: 'duplicate' | 'remove' | 'delete', data?: SelectorValue) => void;
};

const SelectorItem = ({
  className = '',
  selector = '',
  label,
  type = 'class',
  editable = true,
  active = false,
  readOnly = false,
  onClick,
  onChange,
  onAction
}: SelectorItemProps) => {
  const handleClick = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      if (!readOnly) {
        e.stopPropagation();
      }

      onClick?.({ name: selector, type });
    },
    [onClick, readOnly, selector, type]
  );

  // The name while it is being edited, the label otherwise: a rename is of the class, never of its element's label.
  const [editing, setEditing] = useState(false);
  const shown = editing || !label ? selector : label;

  const handleEditOpen = useCallback(() => setEditing(true), []);

  const handleEditClose = useCallback(() => setEditing(false), []);

  const handleChange = useCallback(
    (value: string) => {
      onChange?.({ name: selectorFormatter(value), type });
    },
    [type, onChange]
  );

  return (
    <div
      className={clsx('relative flex h-6 cursor-pointer items-center gap-1 rounded px-1.5 select-none', className, {
        // The class being edited is the strongest mark in the panel; the element's type defaults, a softer one;
        // the classes it also wears but are not being edited, neutral.
        'bg-primary-600 text-white shadow-sm': type !== 'element' && active,
        'bg-primary-500/15 text-primary-800 ring-primary-500/40 dark:text-primary-200 ring-1':
          type === 'element' && active,
        'bg-ui-raised text-ui-fg ring-ui-line hover:bg-ui-hover ring-1': !active,
        'max-w-full min-w-0': !editable
      })}
      onClick={handleClick}
      title={`${type}: ${selector}`}
    >
      {type === 'element' && <i className="fa-solid fa-cube text-[9px] opacity-70" aria-hidden />}
      <div className="flex min-w-0 grow basis-0 font-mono text-[11px]">
        {editable && (
          <Contenteditable
            className="inline text-nowrap focus-visible:m-[1px] focus-visible:px-1 focus-visible:outline-1 focus-visible:outline-dashed"
            value={shown}
            openMode="doubleClick"
            onChange={handleChange}
            onEditOpen={handleEditOpen}
            onEditClose={handleEditClose}
          />
        )}
        {!editable && <span className="truncate">{shown}</span>}
      </div>
      {editable && type !== 'element' && <ItemOptions selector={selector} type={type} onAction={onAction} />}
    </div>
  );
};

export default SelectorItem;
