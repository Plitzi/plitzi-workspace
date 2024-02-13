// Packages
import React, { useCallback, useContext, useState } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import Card from '@plitzi/plitzi-ui-components/Card';

// Alias
import CollectionForm from '@pmodules/Collection/Models/CollectionForm';
import Collection from '@pmodules/Collection/Collection';
import CollectionContext from '@pmodules/Collection/CollectionContext';

const ContainerCollections = props => {
  const { collectionId, onSourceChange = noop } = props;
  const [updateMode, setUpdateMode] = useState(!collectionId);
  const { collections, addCollection, updateCollection } = useContext(CollectionContext);

  const handleCancel = useCallback(() => setUpdateMode(false), [setUpdateMode]);

  const handleSubmitCollection = useCallback(
    async collection => {
      let result;
      const { id, name, namePlural, description, privacy, fields } = collection;
      if (!id) {
        result = await addCollection(name, namePlural, description, privacy, fields);
        onSourceChange(result.id);
      } else {
        result = await updateCollection(id, name, namePlural, description, privacy, fields);
        setUpdateMode(false);
      }
    },
    [setUpdateMode, updateCollection, onSourceChange]
  );

  return (
    <Card className="mx-[5%] grow m-4 relative flex basis-0">
      {!updateMode && collectionId && <Collection id={collectionId} onUpdateMode={setUpdateMode} />}
      {updateMode && (
        <CollectionForm
          key={collectionId}
          {...collections[collectionId]}
          onCancel={handleCancel}
          onSubmit={handleSubmitCollection}
        />
      )}
    </Card>
  );
};

ContainerCollections.propTypes = {
  collectionId: PropTypes.string,
  onSourceChange: PropTypes.func
};

export default ContainerCollections;
