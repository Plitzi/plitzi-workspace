import { revealOnView } from '@plitzi/sdk-shared/schema/motionReveal';

/**
 * Makes the canvas under `root` live as the SDK's root makes a published page (`ThemedRoot`): `data-hydrated` lets the
 * loops run — the declared ones and the space's own CSS keyed off it — and an arrival that waits to be seen plays as it
 * comes into view. Answers the function that puts it back as it was.
 */
export const liveCanvas = (root: Element): (() => void) => {
  root.setAttribute('data-hydrated', '');
  const stopReveal = revealOnView(root);

  return () => {
    stopReveal();
    root.removeAttribute('data-hydrated');
  };
};
