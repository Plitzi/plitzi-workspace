import Flex from '@plitzi/plitzi-ui/Flex';
import { use, useMemo } from 'react';

import { createStoreHook } from '@plitzi/nexus/createStore';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

import Directory from './Directory';
import DirectoryHeader from './DirectoryHeader';

import type { BuilderState } from '@plitzi/sdk-shared';

const AppDirectory = () => {
  const { currentPageId } = use(NavigationContext);
  const { useStore } = createStoreHook<BuilderState>();
  const [[flat, pageFolders]] = useStore(['schema.flat', 'schema.pageFolders']);
  const elements = useMemo(
    () =>
      Object.values(flat)
        .filter(element => {
          const { definition } = element;

          return definition.type === 'page' || definition.type === 'layoutContainer';
        })
        .sort(({ definition: defA, attributes: attrsA }, { definition: defB, attributes: attrsB }) => {
          const { type: typeA, label: labelA } = defA;
          const { type: typeB, label: labelB } = defB;

          // Layouts after Pages
          if (typeA !== typeB) {
            return typeA === 'layoutContainer' ? 1 : -1;
          }

          // Same time, default first
          if (attrsA.default && !attrsB.default) {
            return -1;
          }

          if (!attrsA.default && attrsB.default) {
            return 1;
          }

          // Alphabetic sort
          return (labelA || '').localeCompare(labelB || '');
        }),
    [flat]
  );

  return (
    <Flex direction="column" gap={3} className="w-full p-2">
      <DirectoryHeader pageFolders={pageFolders} />
      <Directory
        id=""
        name="Main Folder"
        slug=""
        parentId=""
        currentPageId={currentPageId}
        pageFolders={pageFolders}
        elements={elements}
        isRootFolder
      />
    </Flex>
  );
};

export default AppDirectory;
