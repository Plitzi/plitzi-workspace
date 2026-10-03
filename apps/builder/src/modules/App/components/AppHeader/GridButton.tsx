import Icon from '@plitzi/plitzi-ui/Icon';
import clsx from 'clsx';
import { use, useCallback } from 'react';

import AppContext from '@pmodules/App/AppContext';

/** The layout grid over the canvas, on and off; lit while it is on. */
const GridButton = () => {
  const { displayGrid, setDisplayGrid } = use(AppContext);

  const handleClick = useCallback(() => setDisplayGrid(shown => !shown), [setDisplayGrid]);

  return (
    <Icon
      className={clsx('h-5 w-5', displayGrid && 'text-violet-600 dark:text-violet-400')}
      onClick={handleClick}
      title={displayGrid ? 'Layout grid: shown — click to hide it' : 'Layout grid: hidden — click to show it'}
      aria-pressed={displayGrid}
      cursor="pointer"
    >
      <i className="fas fa-table-columns" />
    </Icon>
  );
};

export default GridButton;
