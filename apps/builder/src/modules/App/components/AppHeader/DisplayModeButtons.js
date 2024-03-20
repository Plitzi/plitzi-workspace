// Packages
import React, { useCallback, useContext } from 'react';
import classNames from 'classnames';
import Button from '@plitzi/plitzi-ui-components/Button';

// Alias
import AppContext from '@pmodules/App/AppContext';

const DisplayModeButtons = () => {
  const { displayMode, setDisplayMode, mobilePreview, setMobilePreview } = useContext(AppContext);

  const handleMobilePreview = useCallback(() => setMobilePreview(state => !state), [setMobilePreview]);

  const handleClickMode = displayMode => () => setDisplayMode(displayMode);

  return (
    <div className="flex bg-gray-50 border border-gray-200 rounded gap-2">
      <Button
        intent="custom"
        size="custom"
        onClick={handleMobilePreview}
        className={classNames('relative hover:bg-gray-100 h-8 w-8 rounded', {
          'text-gray-500': mobilePreview,
          'text-gray-300 hover:text-gray-500': !mobilePreview
        })}
        title="Mobile Preview"
      >
        <i className="fa-solid fa-desktop" />
        <i className="fa-solid fa-mobile absolute text-xs bg-white bottom-1 right-1" />
      </Button>
      <Button
        intent="custom"
        size="custom"
        onClick={handleClickMode('desktop')}
        className={classNames('hover:bg-gray-100 h-8 w-8 rounded', {
          'text-gray-500': displayMode === 'desktop',
          'text-gray-300 hover:text-gray-500': displayMode !== 'desktop'
        })}
        title="Mode: Desktop"
      >
        <i className="fas fa-desktop" />
      </Button>
      <Button
        intent="custom"
        size="custom"
        onClick={handleClickMode('tablet')}
        className={classNames('hover:bg-gray-100 h-8 w-8 rounded', {
          'text-gray-500': displayMode === 'tablet',
          'text-gray-300 hover:text-gray-500': displayMode !== 'tablet'
        })}
        title="Mode: Tablet"
      >
        <i className="fas fa-tablet-alt" />
      </Button>
      <Button
        intent="custom"
        size="custom"
        onClick={handleClickMode('mobile')}
        className={classNames('hover:bg-gray-100 h-8 w-8 rounded', {
          'text-gray-500': displayMode === 'mobile',
          'text-gray-300 hover:text-gray-500': displayMode !== 'mobile'
        })}
        title="Mode: Mobile"
      >
        <i className="fas fa-mobile-alt" />
      </Button>
    </div>
  );
};

export default DisplayModeButtons;
