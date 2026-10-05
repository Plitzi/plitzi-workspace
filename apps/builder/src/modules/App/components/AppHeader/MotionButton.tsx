import Icon from '@plitzi/plitzi-ui/Icon';
import clsx from 'clsx';
import { use, useCallback } from 'react';

import AppContext from '@pmodules/App/AppContext';

/**
 * The elements' declared motion on the canvas: still while editing — each element shown as it ends up — and played
 * from the start on asking, loops included.
 */
const MotionButton = () => {
  const { motionPlaying, setMotionPlaying, replayMotion } = use(AppContext);

  const handleClick = useCallback(() => {
    if (motionPlaying) {
      setMotionPlaying(false);

      return;
    }

    replayMotion();
  }, [motionPlaying, replayMotion, setMotionPlaying]);

  return (
    <Icon
      className={clsx('h-5 w-5', motionPlaying && 'animate-pulse text-violet-600 dark:text-violet-400')}
      onClick={handleClick}
      title={motionPlaying ? 'Motion: playing — click to hold it still' : 'Motion: still — click to play it'}
      aria-pressed={motionPlaying}
      cursor="pointer"
    >
      {/* Its own icon, never play/pause: those are the preview's, and two of them side by side read as one. */}
      <i className="fa-solid fa-wand-magic-sparkles" />
    </Icon>
  );
};

export default MotionButton;
