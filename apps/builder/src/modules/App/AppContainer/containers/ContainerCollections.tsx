import Card from '@plitzi/plitzi-ui/Card';
import useDidUpdateEffect from '@plitzi/plitzi-ui/hooks/useDidUpdateEffect';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import get from 'lodash-es/get';
import { useCallback, use, useState } from 'react';

import CollectionContext from '@plitzi/sdk-shared/collections/CollectionContext';
import CollectionContainer from '@pmodules/Collection/components/CollectionContainer';
import CollectionForm from '@pmodules/Collection/Models/CollectionForm';

import type { BuilderCollectionContextValue, Collection as TCollection } from '@plitzi/sdk-shared';

const ContainerCollections = () => {
  const { collections, addCollection, updateCollection } = use(CollectionContext) as BuilderCollectionContextValue;
  const [collectionId, setCollectionId] = useStorage<string>('builder-state.collections.selected', '');
  const [updateMode, setUpdateMode] = useState(!collectionId);
  const collection = collectionId ? get(collections, collectionId, undefined) : undefined;

  const handleCancel = useCallback(() => setUpdateMode(false), [setUpdateMode]);

  const handleSubmitCollection = useCallback(
    async (collection: Omit<TCollection, 'records'>) => {
      const { id, name, namePlural, description, privacy, fields } = collection;
      let result: TCollection | undefined;
      if (!id) {
        result = await addCollection(name, namePlural, description, privacy, fields);
        if (result) {
          setCollectionId(result.id);
        }
      } else {
        result = await updateCollection(id, name, namePlural, description, privacy, fields);
        setUpdateMode(false);
      }
    },
    [addCollection, setCollectionId, updateCollection]
  );

  useDidUpdateEffect(() => {
    if (!collectionId && !updateMode) {
      setUpdateMode(true);
    } else if (collectionId && updateMode) {
      setUpdateMode(false);
    }
  }, [collectionId]);

  return (
    <Card className="relative flex grow basis-0">
      <Card.Body grow>
        {!updateMode && collection && (
          <CollectionContainer
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
