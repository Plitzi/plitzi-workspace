// Packages
import React, { use } from 'react';
import classNames from 'classnames';

// Monorepo
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

// Alias
import SchemaMainContext from '@pmodules/Schema/SchemaMainContext';

// Relatives
import Directory from './Directory';
import DirectoryHeader from './DirectoryHeader';
import PageLayouts from './PageLayouts';

/**
 * @param {{
 *   className?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const AppDirectory = props => {
  const { className = '' } = props;
  const { pageFolders } = use(SchemaMainContext);

  const { currentPageId } = use(NavigationContext);

  return (
    <div className={classNames('flex flex-col border-b border-gray-300', className)}>
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
    </div>
  );
};

export default AppDirectory;
