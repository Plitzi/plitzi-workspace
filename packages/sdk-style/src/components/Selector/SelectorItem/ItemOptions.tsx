import ContainerFloating from '@plitzi/plitzi-ui/ContainerFloating';
import Icon from '@plitzi/plitzi-ui/Icon';
import capitalize from 'lodash-es/capitalize.js';
import { useCallback } from 'react';

import { makeId } from '@plitzi/sdk-shared/helpers/utils';

import type { SelectorValue } from '../Selector';
import type { TagType } from '@plitzi/sdk-shared';
import type { Dispatch, SetStateAction } from 'react';

export type ItemOptionsProps = {
  selector?: string;
  type: TagType;
  state: string;
  onChangeState?: (state: string) => void;
  onAction?: (action: 'duplicate' | 'remove' | 'delete', data?: SelectorValue) => void;
  setState: Dispatch<SetStateAction<string>>;
};

const ItemOptions = ({
  selector = '',
  type = 'class',
  state = '',
  onAction,
  onChangeState,
  setState
}: ItemOptionsProps) => {
  const handleClickDuplicate = useCallback(
    () => onAction?.('duplicate', { name: `${selector}-${makeId(4)}`, type }),
    [onAction, selector, type]
  );

  const handleClickRemove = useCallback(() => onAction?.('remove'), [onAction]);

  const handleClickDelete = useCallback(() => {
    console.log('delete', onAction);
    // onAction?.('delete');
  }, [onAction]);

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
    [onChangeState, setState]
  );

  return (
    <ContainerFloating closeOnClick={false}>
      <ContainerFloating.Trigger>
        <Icon icon="fa-solid fa-ellipsis-vertical" className="h-4 w-3 !min-w-3" />
      </ContainerFloating.Trigger>
      <ContainerFloating.Content className="text-xs text-gray-700">
        <div className="bg-gray-50 py-1">
          <div className="mb-1 px-2 font-bold">Actions</div>
          <ul className="flex flex-col gap-1 px-2">
            <li onClick={handleClickDuplicate} className="rounded-sm px-2 py-1 hover:bg-gray-200">
              Duplicate
            </li>
            <li onClick={handleClickRemove} className="rounded-sm px-2 py-1 hover:bg-gray-200">
              Remove
            </li>
            <li onClick={handleClickDelete} className="rounded-sm px-2 py-1 text-red-400 hover:bg-gray-200">
              Delete
            </li>
          </ul>
          <div className="my-2 h-[1px] w-full bg-gray-300" />
          <div className="mb-1 px-2 font-bold">States</div>
          <ul className="flex flex-col gap-1 px-2">
            {['none', 'hover', 'active', 'focus'].map((stateItem, i) => (
              <li
                key={i}
                className="flex items-center gap-1 rounded-sm px-2 py-1 hover:bg-gray-200"
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
      </ContainerFloating.Content>
    </ContainerFloating>
  );
};

export default ItemOptions;
