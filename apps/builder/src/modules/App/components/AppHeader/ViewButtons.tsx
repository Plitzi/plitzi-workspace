import IconGroup from '@plitzi/plitzi-ui/IconGroup';
import BorderBlack from '@plitzi/plitzi-ui/icons/BorderBlack';
import BorderWhite from '@plitzi/plitzi-ui/icons/BorderWhite';
import clsx from 'clsx';
import { use, useCallback } from 'react';

import AppContext from '@pmodules/App/AppContext';

const DISPLAY_BORDER = ['black', 'white', 'none'] as const;

// Says what the next click does, not only what is on: the three states cycle and the icon alone does not tell.
const BORDER_TITLES: Record<(typeof DISPLAY_BORDER)[number], string> = {
  black: 'Element outlines: dark — click for light outlines',
  white: 'Element outlines: light — click to hide them',
  none: 'Element outlines: hidden — click to show them'
};

/**
 * How the canvas is drawn, in one group as history and the devices are: the elements' outlines (dark, light, none),
 * the layout grid, and the elements' declared motion — still while editing, played from the start on asking. Drawn as
 * the group's own icons: `IconGroup` keeps only those of its children.
 */
const ViewButtons = () => {
  const {
    displayBorderComponents,
    setDisplayBorderComponents,
    displayGrid,
    setDisplayGrid,
    motionPlaying,
    setMotionPlaying,
    replayMotion
  } = use(AppContext);

  const handleBorder = useCallback(() => {
    const next = DISPLAY_BORDER[DISPLAY_BORDER.indexOf(displayBorderComponents) + 1] ?? 'black';
    setDisplayBorderComponents(next);
  }, [displayBorderComponents, setDisplayBorderComponents]);
  const handleGrid = useCallback(() => setDisplayGrid(shown => !shown), [setDisplayGrid]);
  const handleMotion = useCallback(() => {
    if (motionPlaying) {
      setMotionPlaying(false);

      return;
    }

    replayMotion();
  }, [motionPlaying, replayMotion, setMotionPlaying]);

  return (
    <IconGroup className="h-8" size="md" gap={4}>
      <IconGroup.Icon title={BORDER_TITLES[displayBorderComponents]} cursor="pointer" onClick={handleBorder}>
        {displayBorderComponents === 'none' && <i className="fas fa-border-none" />}
        {displayBorderComponents === 'white' && <BorderWhite />}
        {displayBorderComponents === 'black' && <BorderBlack />}
      </IconGroup.Icon>
      <IconGroup.Icon
        icon="fas fa-table-columns"
        title={displayGrid ? 'Layout grid: shown — click to hide it' : 'Layout grid: hidden — click to show it'}
        aria-pressed={displayGrid}
        active={displayGrid}
        cursor="pointer"
        onClick={handleGrid}
      />
      {/* Its own icon, never play/pause: those are the preview's, and two of them side by side read as one. */}
      <IconGroup.Icon
        icon={clsx('fa-solid fa-wand-magic-sparkles', motionPlaying && 'animate-pulse')}
        title={motionPlaying ? 'Motion: playing — click to hold it still' : 'Motion: still — click to play it'}
        aria-pressed={motionPlaying}
        active={motionPlaying}
        cursor="pointer"
        onClick={handleMotion}
      />
    </IconGroup>
  );
};

export default ViewButtons;
