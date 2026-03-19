import Contenteditable from '@plitzi/plitzi-ui/ContentEditable';
import { get } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { useCallback, useEffect, useState } from 'react';

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
  onClick?: (selector: SelectorValue) => void;
  onChange?: (selector: SelectorValue) => void;
  onChangeState?: (state: string) => void;
  onAction?: (action: 'duplicate' | 'remove' | 'delete', data?: SelectorValue) => void;
};

const SelectorItem = ({
  className = '',
  selector = '',
  type = 'class',
  editable = true,
  active = false,
  onClick,
  onChange,
  onChangeState,
  onAction
}: SelectorItemProps) => {
  const [state, setState] = useState(() => get(selector.split(':'), '1', ''));

  const handleClick = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      if (editable) {
        e.stopPropagation();
      }

      onClick?.({ name: selector, type });
    },
    [editable, onClick, selector, type]
  );

  const handleChange = useCallback(
    (value: string) => {
      if (state) {
        onChange?.({ name: `${selectorFormatter(value)}:${state}`, type });
      } else {
        onChange?.({ name: selectorFormatter(value), type });
      }
    },
    [type, onChange, state]
  );

  useEffect(() => {
    if (!active && state) {
      setState('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div
      className={clsx(
        'relative flex cursor-pointer items-center gap-1 rounded-sm px-2 py-1 text-white select-none',
        className,
        {
          'bg-primary-400': type === 'class-component' && active,
          'bg-secondary-400': type !== 'class-component' && active,
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
        {state && type === 'class' && <span>:{state}</span>}
      </div>
      {editable && type !== 'class-component' && (
        <ItemOptions
          selector={selector}
          type={type}
          state={state}
          setState={setState}
          onAction={onAction}
          onChangeState={onChangeState}
        />
      )}
    </div>
  );
};

export default SelectorItem;
