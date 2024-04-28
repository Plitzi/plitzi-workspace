// Packages
import React, { use, useCallback } from 'react';
import Button from '@plitzi/plitzi-ui-components/Button';

// Alias
import AppContext from '@pmodules/App/AppContext';
import {
  DISPLAY_BORDER,
  DISPLAY_BORDER_BLACK,
  DISPLAY_BORDER_NONE,
  DISPLAY_BORDER_WHITE
} from '@pmodules/Builder/BuilderHelper';

/** @returns {React.ReactElement} */
const BorderButton = () => {
  const { displayBorderComponents, setDisplayBorderComponents } = use(AppContext);

  const handleClick = useCallback(() => {
    const pos = DISPLAY_BORDER.findIndex(item => item === displayBorderComponents);
    if (DISPLAY_BORDER.length - 1 >= pos + 1) {
      setDisplayBorderComponents(DISPLAY_BORDER[pos + 1]);
    } else {
      setDisplayBorderComponents(DISPLAY_BORDER_BLACK);
    }
  }, [displayBorderComponents, setDisplayBorderComponents]);

  return (
    <Button
      intent="custom"
      size="custom"
      onClick={handleClick}
      className="hover:bg-gray-100 h-8 w-8 bg-gray-50 border border-gray-200 rounded text-gray-500"
      title="Grid"
    >
      {displayBorderComponents === DISPLAY_BORDER_NONE && <i className="fas fa-border-none" />}
      {displayBorderComponents === DISPLAY_BORDER_WHITE && (
        <i className="fas fa-border-all relative">
          <span className="absolute top-[-2px] right-[-4px] font-bold text-[9px] leading-[9px] font-sans bg-white">
            W
          </span>
        </i>
      )}
      {displayBorderComponents === DISPLAY_BORDER_BLACK && (
        <i className="fas fa-border-all relative">
          <span className="absolute top-[-2px] right-[-2px] font-bold text-[10px] leading-[10px] font-sans bg-white">
            B
          </span>
        </i>
      )}
    </Button>
  );
};

export default BorderButton;
