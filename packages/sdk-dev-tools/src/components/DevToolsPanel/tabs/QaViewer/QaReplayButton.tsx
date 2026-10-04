import { use, useCallback } from 'react';

import { isMotionAnimation } from '@plitzi/sdk-shared/schema/motion';

import QaContext from '../../../../qa/QaContext';

/**
 * Plays the page's declared motion again from the start — its arrivals, its loops — without loading the page again,
 * which would also lose whatever state the tester had brought it to.
 */
const QaReplayButton = () => {
  const { pageRef } = use(QaContext);

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
      className="flex h-6 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-zinc-200 px-2 font-medium whitespace-nowrap text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      onClick={handleClick}
    >
      <i className="fa-solid fa-rotate-left text-[10px]" />
      Replay
    </button>
  );
};

export default QaReplayButton;
