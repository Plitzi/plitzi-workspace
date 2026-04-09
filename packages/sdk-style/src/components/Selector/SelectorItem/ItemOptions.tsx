import ContainerFloating from '@plitzi/plitzi-ui/ContainerFloating';
import Icon from '@plitzi/plitzi-ui/Icon';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useCallback } from 'react';

import { makeId } from '@plitzi/sdk-shared/helpers/utils';

import type { SelectorValue } from '../Selector';
import type { TagType } from '@plitzi/sdk-shared';

export type ItemOptionsProps = {
  selector?: string;
  type: TagType;
  onAction?: (action: 'duplicate' | 'remove' | 'delete', data?: SelectorValue) => void;
};

const ItemOptions = ({ selector = '', type = 'class', onAction }: ItemOptionsProps) => {
  const { showDialog } = useModal();

  const handleClickDuplicate = useCallback(
    () => onAction?.('duplicate', { name: `${selector}-${makeId(4)}`, type }),
    [onAction, selector, type]
  );

  const handleClickRemove = useCallback(() => onAction?.('remove'), [onAction]);

  const handleClickDelete = useCallback(async () => {
    const response = await showDialog(
      <Modal.Header>
        <h4>Remove Selector</h4>
      </Modal.Header>,
      <Modal.Body>
        <h4>Do you want to remove this item ?</h4>
      </Modal.Body>,
      undefined,
      { size: 'sm' },
      selector
    );

    if (response) {
      onAction?.('delete');
    }
  }, [onAction, selector, showDialog]);

  return (
    <ContainerFloating>
      <ContainerFloating.Trigger>
        <Icon icon="fa-solid fa-ellipsis-vertical" className="h-4 w-4 !min-w-4" />
      </ContainerFloating.Trigger>
      <ContainerFloating.Content className="text-xs text-zinc-700 dark:text-zinc-300">
        <div className="rounded border border-gray-200 bg-gray-50 py-1 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="mb-1 px-2 font-bold text-zinc-800 dark:text-zinc-200">Actions</div>
          <ul className="flex flex-col gap-1 px-2">
            <li
              onClick={handleClickDuplicate}
              className="cursor-pointer rounded-sm px-2 py-1 hover:bg-gray-200 dark:hover:bg-zinc-700"
            >
              Duplicate
            </li>
            <li
              onClick={handleClickRemove}
              className="cursor-pointer rounded-sm px-2 py-1 hover:bg-gray-200 dark:hover:bg-zinc-700"
            >
              Remove
            </li>
            <li
              onClick={handleClickDelete}
              className="cursor-pointer rounded-sm px-2 py-1 text-red-400 hover:bg-gray-200 dark:hover:bg-zinc-700"
            >
              Delete
            </li>
          </ul>
        </div>
      </ContainerFloating.Content>
    </ContainerFloating>
  );
};

export default ItemOptions;
