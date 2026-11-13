import { use, useCallback } from 'react';

import { isMotionAnimation } from '@plitzi/sdk-shared/schema';

import PageContext from '../../../../PageContext';

/**
 * Plays the page's declared motion again from the start — its arrivals, its loops — without loading the page again,
 * which would also lose whatever state the tester had brought it to.
 */
const QaReplayButton = () => {
  const pageRef = use(PageContext);

  const handleClick = useCallback(() => {
    pageRef.current
      ?.getAnimations({ subtree: true })
      .filter(isMotionAnimation)
      .forEach(animation => {
        animation.cancel();
        animation.play();
      });
  }, [pageRef]);

  return (
    <button
      type="button"
      title="Play the page's arrivals and loops again from the start"
      className="border-ui-line text-ui-fg-muted hover:bg-ui-hover flex h-6 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2 font-medium whitespace-nowrap transition-colors"
      onClick={handleClick}
    >
      <i className="fa-solid fa-rotate-left text-[10px]" />
      Replay
    </button>
  );
};

export default QaReplayButton;
