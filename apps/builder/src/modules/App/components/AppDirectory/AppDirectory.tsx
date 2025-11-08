import Flex from '@plitzi/plitzi-ui/Flex';
import { use } from 'react';

import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import SchemaMainContext from '@plitzi/sdk-schema/SchemaMainContext';

import Directory from './Directory';
import DirectoryHeader from './DirectoryHeader';

const AppDirectory = () => {
  const { pageFolders } = use(SchemaMainContext);
  const { currentPageId } = use(NavigationContext);

  return (
    <Flex direction="column" gap={3} className="w-full">
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
