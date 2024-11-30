// Packages
import React, { use, useCallback } from 'react';
import BorderBlack from '@plitzi/plitzi-ui/icons/BorderBlack';
import BorderWhite from '@plitzi/plitzi-ui/icons/BorderWhite';
import Icon from '@plitzi/plitzi-ui/Icon';

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
    <Icon className="h-5 w-5" onClick={handleClick} title="Grid" cursor="pointer">
      {displayBorderComponents === DISPLAY_BORDER_NONE && <i className="fas fa-border-none" />}
      {displayBorderComponents === DISPLAY_BORDER_WHITE && <BorderWhite />}
      {displayBorderComponents === DISPLAY_BORDER_BLACK && <BorderBlack />}
    </Icon>
  );
};

export default BorderButton;
