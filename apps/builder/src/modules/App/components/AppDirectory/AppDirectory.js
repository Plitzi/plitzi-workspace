// Packages
import React, { use } from 'react';
import Flex from '@plitzi/plitzi-ui/Flex';

// Monorepo
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

// Alias
import SchemaMainContext from '@pmodules/Schema/SchemaMainContext';

// Relatives
import Directory from './Directory';
import DirectoryHeader from './DirectoryHeader';
import PageLayouts from './PageLayouts';

/**
 * @param {{}} props
 * @returns {React.ReactElement}
 */
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
      <PageLayouts className="" />
    </Flex>
  );
};

export default AppDirectory;
