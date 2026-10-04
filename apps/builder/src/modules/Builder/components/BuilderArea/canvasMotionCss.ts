import { MOTION_PLAY_CSS, MOTION_STILL_CSS } from '@plitzi/sdk-shared/schema/motion';

/**
 * In preview, what the SDK's root does on a published page (`overflow-x: clip` on `.plitzi-sdk`): an arrival from the
 * side starts beside where it lands, and until it has played that offset must not scroll the canvas sideways. The
 * canvas's box already scrolls the other way, which makes `clip` compute to `hidden` — the same cut.
 */
export const PREVIEW_CANVAS_CSS = '.builder-iframe { overflow-x: hidden; }';

/**
 * How the canvas plays the declared motion. Editing, it is held at its end — or played from the start with Play; in
 * preview it is not touched: the page plays it as a published page does.
 */
export const canvasMotionCss = (previewMode: boolean, playing: boolean): string => {
  if (previewMode) {
    return PREVIEW_CANVAS_CSS;
  }

  return playing ? MOTION_PLAY_CSS : MOTION_STILL_CSS;
};
