import Contenteditable from '@plitzi/plitzi-ui/ContentEditable';
import clsx from 'clsx';
import { useCallback } from 'react';

import { selectorFormatter } from '../SelectorHelper';
import ItemOptions from './ItemOptions';

import type { SelectorValue } from '../Selector';
import type { TagType } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type SelectorItemProps = {
  className?: string;
  selector?: string;
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

  const handleChange = useCallback(
    (value: string) => {
      onChange?.({ name: selectorFormatter(value), type });
    },
    [type, onChange]
  );

  return (
    <div
      className={clsx(
        'relative flex cursor-pointer items-center gap-1 rounded-sm px-2 py-1 text-white select-none',
        className,
        {
          'bg-primary-400': type === 'element' && active,
          'bg-secondary-400': type !== 'element' && active,
          'bg-gray-500': !active,
          'max-w-full min-w-0': !editable
        }
      )}
      onClick={handleClick}
      title={`${type}: ${selector}`}
    >
      <div className="flex min-w-0 grow basis-0 text-xs">
        {editable && (
          <Contenteditable
            className="inline text-nowrap focus-visible:m-[1px] focus-visible:px-1 focus-visible:outline-1 focus-visible:outline-dashed"
            value={selector}
            openMode="doubleClick"
            onChange={handleChange}
          />
        )}
        {!editable && selector}
      </div>
      {editable && type !== 'element' && <ItemOptions selector={selector} type={type} onAction={onAction} />}
    </div>
  );
};

export default SelectorItem;
