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
      className={clsx('relative flex cursor-pointer items-center gap-1 rounded-sm px-2 py-1 select-none', className, {
        // The class being edited is the strongest mark in the panel; the element's type defaults, a softer one;
        // the classes it also wears but are not being edited, neutral.
        'bg-primary-600 text-white': type !== 'element' && active,
        'bg-primary-500/20 text-primary-800 dark:text-primary-200': type === 'element' && active,
        'bg-gray-200 text-zinc-700 hover:bg-gray-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600':
          !active,
        'max-w-full min-w-0': !editable
      })}
      onClick={handleClick}
      title={`${type}: ${selector}`}
    >
      <div className="flex min-w-0 grow basis-0 text-xs">
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
        {!editable && shown}
      </div>
      {editable && type !== 'element' && <ItemOptions selector={selector} type={type} onAction={onAction} />}
    </div>
  );
};

export default SelectorItem;
