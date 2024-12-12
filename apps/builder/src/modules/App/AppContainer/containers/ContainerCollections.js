// Packages
import React, { useCallback, use, useState } from 'react';
import noop from 'lodash/noop';
import Card from '@plitzi/plitzi-ui-components/Card';

// Alias
import CollectionForm from '@pmodules/Collection/Models/CollectionForm';
import Collection from '@pmodules/Collection/Collection';
import CollectionContext from '@pmodules/Collection/CollectionContext';

/**
 * @param {{
 *   collectionId?: string;
 *   onSourceChange?: (sourceId: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const ContainerCollections = props => {
  const { collectionId, onSourceChange = noop } = props;
  const [updateMode, setUpdateMode] = useState(!collectionId);
  const { collections, addCollection, updateCollection } = use(CollectionContext);

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
    <Card className="grow relative flex basis-0" rounded={false}>
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

export default ContainerCollections;
