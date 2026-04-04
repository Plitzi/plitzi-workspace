import Flex from '@plitzi/plitzi-ui/Flex';
import { use } from 'react';

import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import { createStoreHook } from '@plitzi/sdk-shared/store';

import Directory from './Directory';
import DirectoryHeader from './DirectoryHeader';

import type { BuilderState } from '@plitzi/sdk-shared';

const AppDirectory = () => {
  const { currentPageId } = use(NavigationContext);
  const { useStore } = createStoreHook<BuilderState>();
  const [pageFolders] = useStore('schema.pageFolders');

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
        isRootFolder
      />
    </Flex>
  );
};

export default AppDirectory;
