import { revealOnView } from '@plitzi/sdk-shared/schema/motionReveal';

export type LiveCanvasOptions = {
  /**
   * Whether an arrival that waits to be seen plays as it comes into view. Off while Play runs on the canvas being
   * edited: there every arrival plays at once (`MOTION_PLAY_CSS`), in view or not.
   */
  reveal: boolean;
};

/**
 * Makes the canvas under `root` live as the SDK's root makes a published page (`ThemedRoot`): `data-hydrated` lets the
 * loops run — the declared ones and the space's own CSS keyed off it — and, with `reveal`, an arrival that waits to be
 * seen plays as it comes into view. Answers the function that puts it back as it was.
 */
export const liveCanvas = (root: Element, { reveal }: LiveCanvasOptions): (() => void) => {
  root.setAttribute('data-hydrated', '');
  const stopReveal = reveal ? revealOnView(root) : () => undefined;

  return () => {
    stopReveal();
    root.removeAttribute('data-hydrated');
  };
};
