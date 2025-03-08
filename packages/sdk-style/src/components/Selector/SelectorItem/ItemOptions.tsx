import ContainerFloating from '@plitzi/plitzi-ui/ContainerFloating';
import Icon from '@plitzi/plitzi-ui/Icon';
import capitalize from 'lodash/capitalize';
import { useCallback } from 'react';

import { makeId } from '@plitzi/sdk-shared/utils';

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
    <ContainerFloating>
      <ContainerFloating.Trigger>
        <Icon icon="fa-solid fa-ellipsis-vertical" className="!min-w-3 w-3 h-4" />
      </ContainerFloating.Trigger>
      <ContainerFloating.Content className="text-gray-700 text-xs">
        <div className="py-1 bg-gray-50">
          <div className="font-bold mb-1 px-2">Actions</div>
          <ul className="flex flex-col gap-1 px-2">
            <li onClick={handleClickDuplicate} className="hover:bg-gray-200 px-2 py-1 rounded-sm">
              Duplicate
            </li>
            <li onClick={handleClickRemove} className="hover:bg-gray-200 px-2 py-1 rounded-sm">
              Remove
            </li>
            <li onClick={handleClickDelete} className="text-red-400 hover:bg-gray-200 px-2 py-1 rounded-sm">
              Delete
            </li>
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
      </ContainerFloating.Content>
    </ContainerFloating>
  );
};

export default ItemOptions;
