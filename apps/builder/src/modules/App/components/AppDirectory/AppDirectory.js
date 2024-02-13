// Packages
import React, { useContext } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

// Alias
import SchemaMainContext from '@pmodules/Schema/SchemaMainContext';
import NavigationContext from '@pmodules/Navigation/NavigationContext';

// Relatives
import Directory from './Directory';
import DirectoryHeader from './DirectoryHeader';
import PageLayouts from './PageLayouts';

const AppDirectory = props => {
  const { className = '' } = props;
  const { pageFolders } = useContext(SchemaMainContext);

  const { currentPageId } = useContext(NavigationContext);

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

AppDirectory.propTypes = {
  className: PropTypes.string
};

export default AppDirectory;
