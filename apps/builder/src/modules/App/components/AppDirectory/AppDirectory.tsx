import Flex from '@plitzi/plitzi-ui/Flex';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { useCallback, useMemo } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';

import Directory from './Directory';
import DirectoryHeader from './DirectoryHeader';

const AppDirectory = () => {
  const [[flat, pageFolders, currentPageId]] = useBuilderStore([
    'schema.flat',
    'schema.pageFolders',
    'navigation.currentPageId'
  ]);
  const { webId } = useBuilderNetwork();
  // Which folders are open, the way the style inspector keeps its sections: one record, every folder closed until it is
  // opened. Keyed by space too, since two spaces can have a folder of one id.
  const [collapsedCache, setCollapsedCache] = useStorage<Record<string, boolean | undefined>>(
    'builder-state.pageFolders.collapsedCache',
    {}
  );
  const keyOf = useCallback((folderId: string) => `${String(webId)}:${folderId || 'root'}`, [webId]);
  const isCollapsed = useCallback(
    (folderId: string) => collapsedCache[keyOf(folderId)] ?? true,
    [collapsedCache, keyOf]
  );
  const handleCollapse = useCallback(
    (folderId: string, collapsed: boolean) => setCollapsedCache(state => ({ ...state, [keyOf(folderId)]: collapsed })),
    [setCollapsedCache, keyOf]
  );
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
        isCollapsed={isCollapsed}
        onCollapse={handleCollapse}
      />
    </Flex>
  );
};

export default AppDirectory;
