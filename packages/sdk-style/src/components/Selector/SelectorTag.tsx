import ContainerFloating from '@plitzi/plitzi-ui/ContainerFloating';
import Contenteditable from '@plitzi/plitzi-ui/ContentEditable';
import classNames from 'classnames';
import capitalize from 'lodash/capitalize';
import get from 'lodash/get';
import { useCallback, useEffect, useState } from 'react';

import { makeId } from '@plitzi/sdk-shared/utils';

import { selectorFormatter } from './SelectorHelper';

import type { SelectorValue } from './Selector';
import type { TagType } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type SelectorTagProps = {
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

const SelectorTag = ({
  className = '',
  selector = '',
  type = 'class',
  editable = true,
  active = false,
  onClick,
  onChange,
  onChangeState,
  onAction
}: SelectorTagProps) => {
  const [isVisible, setIsVisible] = useState(false);
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

  const handleClickDuplicate = useCallback(
    () => onAction?.('duplicate', { name: `${selector}-${makeId(4)}`, type }),
    [onAction, selector, type]
  );

  const handleClickRemove = useCallback(() => onAction?.('remove'), [onAction]);

  // const handleClickDelete = useCallback(() => onAction('delete'), [onAction]);

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

  const handleDropVisible = useCallback((isVisible: boolean) => setIsVisible(isVisible), []);

  const handleClickState = useCallback(
    (state: string) => () => {
      if (state === 'none') {
        onChangeState?.('');
        setState('');
      } else {
        onChangeState?.(state);
        setState(state);
      }
    },
    [onChangeState]
  );

  return (
    <div
      className={classNames(
        'group px-1 relative flex items-center rounded-sm text-white select-none cursor-pointer',
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
      <div className="mx-1.5">
        {editable && (
          <div className="flex group-hover:mr-3 truncate">
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
      <ContainerFloating
        className={classNames('absolute right-0 text-xs px-1 rounded-r h-full', {
          'hidden group-hover:flex': !isVisible && editable,
          flex: isVisible && editable,
          hidden: !editable,
          'bg-blue-400': type === 'class' && active,
          'bg-green-500': type === 'state' && active,
          'bg-purple-500': type === 'parent' && active,
          'bg-pink-500': type === 'element' && active,
          'bg-yellow-500': type === 'id' && active,
          'bg-gray-500': !active
        })}
        onContainerVisible={handleDropVisible}
        backgroundDisabled
      >
        <ContainerFloating.Container className="text-gray-700">
          <div className="py-1 bg-gray-50">
            <div className="font-bold mb-1 px-2">Actions</div>
            <ul className="flex flex-col gap-1 px-2">
              <li onClick={handleClickDuplicate} className="hover:bg-gray-200 px-2 py-1 rounded-sm">
                Duplicate
              </li>
              <li onClick={handleClickRemove} className="hover:bg-gray-200 px-2 py-1 rounded-sm">
                Remove
              </li>
              {/* <li onClick={handleClickDelete} className="text-red-400 hover:bg-gray-200 px-2 py-1 rounded-sm">
                Delete
              </li> */}
            </ul>
            <div className="bg-gray-300 h-[1px] w-full my-2" />
            <div className="font-bold mb-1 px-2">States</div>
            <ul className="flex flex-col gap-1 px-2">
              {['none', 'hover', 'active', 'focus'].map((stateItem, i) => (
                <li
                  key={i}
                  className="flex items-center hover:bg-gray-200 px-2 py-1 rounded-sm gap-1"
                  onClick={handleClickState(stateItem)}
                >
                  {(state === stateItem || (state === '' && stateItem === 'none')) && (
                    <i className="fa-solid fa-check text-green-500" />
                  )}
                  {capitalize(stateItem)}
                </li>
              ))}
            </ul>
          </div>
        </ContainerFloating.Container>
      </ContainerFloating>
    </div>
  );
};

export default SelectorTag;
