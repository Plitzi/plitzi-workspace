import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import Icon from '@plitzi/plitzi-ui/Icon';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import classNames from 'classnames';
import { use, useCallback } from 'react';

import CollectionContext from '@plitzi/sdk-shared/collections/CollectionContext';

import type { BuilderCollectionContextValue } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type CollectionsProps = {
  collectionId?: string;
  onSourceChange?: (collectionId?: string) => void;
};

const Collections = ({ collectionId, onSourceChange }: CollectionsProps) => {
  const { showDialog } = useModal();
  const { collections, removeCollection } = use(CollectionContext) as BuilderCollectionContextValue;

  const handleClickAddCollection = useCallback(() => onSourceChange?.(undefined), [onSourceChange]);

  const handleClickRemoveCollection = useCallback(
    (id: string) => async (e: MouseEvent<HTMLElement>) => {
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
        if (collectionId === id) {
          onSourceChange?.();
        }
      }
    },
    [showDialog, removeCollection, collectionId, onSourceChange]
  );

  const handleClick = useCallback((collectionId: string) => () => onSourceChange?.(collectionId), [onSourceChange]);

  return (
    <Flex direction="column" gap={4} className="w-full">
      <Button iconPlacement="before" size="sm" onClick={handleClickAddCollection}>
        <Button.Icon icon="fa-solid fa-plus" />
        New Collection
      </Button>
      <div className="w-full border-b border-solid border-gray-200" />
      <Flex direction="column" gap={2}>
        {Object.values(collections).map((collection, i) => {
          const { id, namePlural } = collection;

          return (
            <div
              key={i}
              className={classNames('flex w-full cursor-pointer items-center justify-between', {
                'text-primary-500': collectionId === id
              })}
              onClick={handleClick(id)}
            >
              <div className="flex items-center">
                <Icon icon="fas fa-database" intent="custom" className="mr-1" />
                {namePlural}
              </div>
              <div className="flex">
                <i
                  className="fas fa-trash text-red-400 hover:text-red-500"
                  title="Remove"
                  onClick={handleClickRemoveCollection(id)}
                />
              </div>
            </div>
          );
        })}
      </Flex>
    </Flex>
  );
};

export default Collections;
