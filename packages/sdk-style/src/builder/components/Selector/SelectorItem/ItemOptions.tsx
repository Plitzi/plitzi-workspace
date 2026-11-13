import ContainerFloating from '@plitzi/plitzi-ui/ContainerFloating';
import Icon from '@plitzi/plitzi-ui/Icon';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useCallback } from 'react';

import { makeId } from '@plitzi/sdk-shared/helpers';

import { ITEM_CLASS } from './helpers';

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
      <Modal.Header>Delete .{selector}</Modal.Header>,
      <Modal.Body>
        <p className="m-0 text-sm">
          The class is deleted from the space, and every element that wears it loses the styles it gives. To take it off
          this element only, use “Remove from this element”.
        </p>
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
        <Icon
          icon="fa-solid fa-ellipsis-vertical"
          className="h-4 w-3 !min-w-3 rounded-sm opacity-70 hover:opacity-100"
          title="Class actions: duplicate, remove, delete"
        />
      </ContainerFloating.Trigger>
      <ContainerFloating.Content className="text-ui-fg text-xs">
        <div className="border-ui-line bg-ui-overlay min-w-44 rounded-md border p-1 shadow-lg">
          <ul className="m-0 flex list-none flex-col p-0">
            <li>
              <button type="button" className={ITEM_CLASS} onClick={handleClickDuplicate}>
                Duplicate class
              </button>
            </li>
            <li>
              <button type="button" className={ITEM_CLASS} onClick={handleClickRemove}>
                Remove from this element
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`${ITEM_CLASS} text-red-600 dark:text-red-400`}
                onClick={handleClickDelete}
              >
                Delete from the space…
              </button>
            </li>
          </ul>
        </div>
      </ContainerFloating.Content>
    </ContainerFloating>
  );
};

export default ItemOptions;
