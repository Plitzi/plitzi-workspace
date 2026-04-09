import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { use, useCallback } from 'react';

import CollectionContext from '@plitzi/sdk-shared/collections/CollectionContext';

import Collection from './components/Collection';

import type { BuilderCollectionContextValue } from '@plitzi/sdk-shared';

const Collections = () => {
  const { collections } = use(CollectionContext) as BuilderCollectionContextValue;

  const [collectionId, setCollectionId] = useStorage<string>(
    'builder-state.collections.selected',
    Object.values(collections)[0]?.id
  );

  const handleClickAddCollection = useCallback(() => setCollectionId(''), [setCollectionId]);

  return (
    <Flex direction="column" gap={4} className="w-full p-2">
      <Button iconPlacement="before" size="sm" onClick={handleClickAddCollection}>
        <Button.Icon icon="fa-solid fa-plus" />
        New Collection
      </Button>
      <div className="w-full border-b border-solid border-gray-200 dark:border-zinc-700" />
      <Flex direction="column" gap={2}>
        {Object.values(collections).map(collection => {
          const { id, namePlural } = collection;

          return (
            <Collection
              key={id}
              id={id}
              namePlural={namePlural}
              active={collectionId === id}
              setCollectionId={setCollectionId}
            />
          );
        })}
      </Flex>
    </Flex>
  );
};

export default Collections;
