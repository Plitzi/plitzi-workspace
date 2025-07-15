import Card from '@plitzi/plitzi-ui/Card';
import { useCallback, use, useState } from 'react';

import Collection from '@pmodules/Collection/Collection';
import CollectionContext from '@pmodules/Collection/CollectionContext';
import CollectionForm from '@pmodules/Collection/Models/CollectionForm';

import type { Collection as TCollection } from '@plitzi/sdk-shared';

export type ContainerCollectionsProps = {
  collectionId?: string;
  onSourceChange?: (sourceId: string) => void;
};

const ContainerCollections = ({ collectionId, onSourceChange }: ContainerCollectionsProps) => {
  const [updateMode, setUpdateMode] = useState(!collectionId);
  const { collections, addCollection, updateCollection } = use(CollectionContext);

  const handleCancel = useCallback(() => setUpdateMode(false), [setUpdateMode]);

  const handleSubmitCollection = useCallback(
    async (collection: TCollection) => {
      const { id, name, namePlural, description, privacy, fields } = collection;
      let result: TCollection;
      if (!id && addCollection) {
        result = await addCollection(name, namePlural, description, privacy, fields);
        onSourceChange?.(result.id);
      } else if (updateCollection) {
        result = await updateCollection(id, name, namePlural, description, privacy, fields);
        setUpdateMode(false);
      }
    },
    [addCollection, onSourceChange, updateCollection]
  );

  return (
    <Card className="relative flex grow basis-0">
      <Card.Body grow>
        {!updateMode && collectionId && <Collection id={collectionId} onUpdateMode={setUpdateMode} />}
        {updateMode && collectionId && (
          <CollectionForm
            key={collectionId}
            {...collections[collectionId]}
            onCancel={handleCancel}
            onSubmit={handleSubmitCollection}
          />
        )}
        {updateMode && !collectionId && (
          <CollectionForm key={collectionId} onCancel={handleCancel} onSubmit={handleSubmitCollection} />
        )}
      </Card.Body>
    </Card>
  );
};

export default ContainerCollections;
