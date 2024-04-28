// Packages
import React, { use } from 'react';
import noop from 'lodash/noop';
import classNames from 'classnames';
import Button from '@plitzi/plitzi-ui-components/Button';
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
  const { collectionId, onSourceChange = noop } = props;
  const { showModal } = useModal();
  const { collections, removeCollection } = use(CollectionContext);

  const handleClickAddCollection = () => onSourceChange(undefined);

  const handleClickRemoveCollection = id => async e => {
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
  };

  const handleClick = collectionId => () => onSourceChange(collectionId);

  return (
    <div className="flex flex-col">
      <Button
        intent="custom"
        size="custom"
        onClick={handleClickAddCollection}
        className="px-4 py-3 bg-gray-600 text-white"
      >
        <i className="fas fa-database fa-2x mr-4" />
        Add Collection
      </Button>
      <div className="flex flex-col">
        {Object.values(collections).map((collection, i) => {
          const { id, namePlural } = collection;

          return (
            <div
              key={i}
              className={classNames(
                'w-full flex px-3 py-4 items-center justify-between hover:bg-blue-200 border-gray-300 border-b cursor-pointer',
                {
                  'bg-blue-200/50': collectionId === id
                }
              )}
              onClick={handleClick(id)}
            >
              <div className="flex items-center">
                <i className="fas fa-database mr-1 text-blue-400" />
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
      </div>
    </div>
  );
};

export default Collections;
