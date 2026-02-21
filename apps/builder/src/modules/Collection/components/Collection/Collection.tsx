import Icon from '@plitzi/plitzi-ui/Icon';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import clsx from 'clsx';
import { use, useCallback } from 'react';

import CollectionContext from '@plitzi/sdk-shared/collections/CollectionContext';

import type { BuilderCollectionContextValue } from '@plitzi/sdk-shared/types/CollectionTypes';
import type { Dispatch, SetStateAction } from 'react';

export type CollectionProps = {
  id: string;
  active?: boolean;
  namePlural: string;
  setCollectionId?: Dispatch<SetStateAction<string>>;
};

const Collection = ({ id, active = false, namePlural, setCollectionId }: CollectionProps) => {
  const { showDialog } = useModal();
  const { removeCollection } = use(CollectionContext) as BuilderCollectionContextValue;

  const handleClick = useCallback(() => setCollectionId?.(id), [setCollectionId, id]);

  const handleClickRemoveCollection = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const response = await showDialog(
        <Modal.Header>
          <h5>Remove Collection</h5>
        </Modal.Header>,
        <Modal.Body>
          <h4 className="px-3 py-2">Do you want to remove this item ?</h4>
        </Modal.Body>,
        undefined,
        undefined,
        id
      );

      if (response) {
        void removeCollection(id);
        setCollectionId?.('');
      }
    },
    [showDialog, id, removeCollection, setCollectionId]
  );

  return (
    <div
      className={clsx('flex w-full cursor-pointer items-center justify-between', { 'text-primary-500': active })}
      onClick={handleClick}
    >
      <div className="flex items-center">
        <Icon icon="fas fa-database" intent="custom" className="mr-1" />
        {namePlural}
      </div>
      <div className="flex">
        <i
          className="fas fa-trash text-red-400 hover:text-red-500"
          title="Remove"
          onClick={handleClickRemoveCollection}
        />
      </div>
    </div>
  );
};

export default Collection;
