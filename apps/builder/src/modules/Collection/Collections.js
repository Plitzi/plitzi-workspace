// Packages
import React, { use, useCallback } from 'react';
import classNames from 'classnames';
import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import Icon from '@plitzi/plitzi-ui/Icon';
import Modal from '@plitzi/plitzi-ui-components/Modal';
import useModal from '@plitzi/plitzi-ui-components/Modal/useModal';

// Relatives
import CollectionContext from './CollectionContext';

/**
 * @param {{
 *   collectionId?: string;
 *   onSourceChange?: (collectionId?: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Collections = props => {
  const { collectionId, onSourceChange } = props;
  const { showModal } = useModal();
  const { collections, removeCollection } = use(CollectionContext);

  const handleClickAddCollection = useCallback(() => onSourceChange?.(undefined), [onSourceChange]);

  const handleClickRemoveCollection = useCallback(
    id => async e => {
      e.stopPropagation();
      const response = await showModal(
        <Modal.Header>
          <h5>Remove Collection</h5>
        </Modal.Header>,
        <Modal.Body>
          <h4 className="px-3 py-2">Do you want to remove this item ?</h4>
        </Modal.Body>,
        null,
        { placement: 'center', renderFooter: true }
      );

      if (response.result) {
        removeCollection(id);
        if (collectionId === id) {
          onSourceChange();
        }
      }
    },
    [showModal, removeCollection, onSourceChange]
  );

  const handleClick = useCallback(collectionId => () => onSourceChange(collectionId), [onSourceChange]);

  return (
    <Flex direction="column" gap={4} className="w-full">
      <Button iconPlacement="before" size="sm" onClick={handleClickAddCollection}>
        <Button.Icon icon="fa-solid fa-plus" />
        Add Collection
      </Button>
      <div className="w-full border-solid border-b border-gray-200" />
      <Flex direction="column" gap={2}>
        {Object.values(collections).map((collection, i) => {
          const { id, namePlural } = collection;

          return (
            <div
              key={i}
              className={classNames('w-full flex items-center justify-between cursor-pointer', {
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
