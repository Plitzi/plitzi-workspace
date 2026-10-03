import Icon from '@plitzi/plitzi-ui/Icon';
import BorderBlack from '@plitzi/plitzi-ui/icons/BorderBlack';
import BorderWhite from '@plitzi/plitzi-ui/icons/BorderWhite';
import { use, useCallback } from 'react';

import AppContext from '@pmodules/App/AppContext';

const DISPLAY_BORDER = ['black', 'white', 'none'] as const;

// Says what the next click does, not only what is on: the three states cycle and the icon alone does not tell.
const TITLES: Record<(typeof DISPLAY_BORDER)[number], string> = {
  black: 'Element outlines: dark — click for light outlines',
  white: 'Element outlines: light — click to hide them',
  none: 'Element outlines: hidden — click to show them'
};

const BorderButton = () => {
  const { displayBorderComponents, setDisplayBorderComponents } = use(AppContext);

  const handleClick = useCallback(() => {
    const pos = DISPLAY_BORDER.findIndex(item => item === displayBorderComponents);
    if (DISPLAY_BORDER.length - 1 >= pos + 1) {
      setDisplayBorderComponents(DISPLAY_BORDER[pos + 1]);
    } else {
      setDisplayBorderComponents('black');
    }
  }, [displayBorderComponents, setDisplayBorderComponents]);

  return (
    <Icon className="h-5 w-5" onClick={handleClick} title={TITLES[displayBorderComponents]} cursor="pointer">
      {displayBorderComponents === 'none' && <i className="fas fa-border-none" />}
      {displayBorderComponents === 'white' && <BorderWhite />}
      {displayBorderComponents === 'black' && <BorderBlack />}
    </Icon>
  );
};

export default BorderButton;
