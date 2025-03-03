import Contenteditable from '@plitzi/plitzi-ui/ContentEditable';
import classNames from 'classnames';
import get from 'lodash/get';
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
      className={classNames(
        'pl-4 pr-2 py-0.5 relative flex items-center rounded-sm text-white select-none cursor-pointer gap-1',
        className,
        {
          'bg-blue-400': type === 'class' && active,
          'bg-green-500': type === 'state' && active,
          'bg-purple-500': type === 'parent' && active,
          'bg-pink-500': type === 'element' && active,
          'bg-yellow-500': type === 'id' && active,
          'bg-gray-500': !active
        }
      )}
      onClick={handleClick}
    >
      <div
        className={classNames('px-1 my-1 rounded-sm bg-white capitalize font-bold text-xs', {
          'text-blue-400': type === 'class' && active,
          'text-green-500': type === 'state' && active,
          'text-purple-500': type === 'parent' && active,
          'text-pink-500': type === 'element' && active,
          'text-yellow-500': type === 'id' && active,
          'text-gray-400': !active
        })}
        title={type}
      >
        {type[0]}
      </div>
      <div className="flex basis-0 grow min-w-0">
        {editable && (
          <div className="flex truncate">
            <Contenteditable
              className="focus-visible:px-1 focus-visible:m-[1px] focus-visible:outline-dashed focus-visible:outline-1 text-xs"
              value={selector}
              onChange={handleChange}
              openMode="doubleClick"
            />
            {state && <span className="text-xs">:{state}</span>}
          </div>
        )}
        {!editable && <div className="text-xs truncate">{selector}</div>}
      </div>
      {editable && (
        <ItemOptions
          selector={selector}
          active={active}
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
