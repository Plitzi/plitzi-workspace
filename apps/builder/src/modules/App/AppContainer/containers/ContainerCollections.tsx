import Card from '@plitzi/plitzi-ui/Card';
import get from 'lodash/get';
import { useCallback, use, useState } from 'react';

import CollectionContext from '@plitzi/sdk-shared/collections/CollectionContext';
import Collection from '@pmodules/Collection/Collection';
import CollectionForm from '@pmodules/Collection/Models/CollectionForm';

import type { BuilderCollectionContextValue, Collection as TCollection } from '@plitzi/sdk-shared';

export type ContainerCollectionsProps = {
  collectionId?: string;
  onSourceChange?: (sourceId: string) => void;
};

const ContainerCollections = ({ collectionId = '', onSourceChange }: ContainerCollectionsProps) => {
  const [updateMode, setUpdateMode] = useState(!collectionId);
  const { collections, addCollection, updateCollection } = use(CollectionContext) as BuilderCollectionContextValue;
  const collection = get(collections, collectionId, undefined);

  const handleCancel = useCallback(() => setUpdateMode(false), [setUpdateMode]);

  const handleSubmitCollection = useCallback(
    async (collection: Omit<TCollection, 'records'>) => {
      const { id, name, namePlural, description, privacy, fields } = collection;
      let result: TCollection | undefined;
      if (!id) {
        result = await addCollection(name, namePlural, description, privacy, fields);
        if (result) {
          onSourceChange?.(result.id);
        }
      } else {
        result = await updateCollection(id, name, namePlural, description, privacy, fields);
        setUpdateMode(false);
      }
    },
    [addCollection, onSourceChange, updateCollection]
  );

  return (
    <Card className="relative flex grow basis-0">
      <Card.Body grow>
        {!updateMode && collection && (
          <Collection
            id={collection.id}
            records={collection.records}
            fields={collection.fields}
            name={collection.name}
            onUpdateMode={setUpdateMode}
          />
        )}
        {updateMode && collectionId && (
          <CollectionForm
            key={collectionId}
            {...collection}
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
