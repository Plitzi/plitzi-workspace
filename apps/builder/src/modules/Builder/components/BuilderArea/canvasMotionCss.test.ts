import { describe, expect, it } from 'vitest';

import { MOTION_PLAY_CSS, MOTION_STILL_CSS } from '@plitzi/sdk-shared/schema/motion';

import { canvasMotionCss, PREVIEW_CANVAS_CSS } from './canvasMotionCss';

describe('canvasMotionCss', () => {
  it('holds motion still while editing, and plays it with Play', () => {
    expect(canvasMotionCss(false, false)).toBe(MOTION_STILL_CSS);
    expect(canvasMotionCss(false, true)).toBe(MOTION_PLAY_CSS);
  });

  it('leaves motion to the page in preview, and keeps an arrival from the side from scrolling the canvas', () => {
    expect(canvasMotionCss(true, false)).toBe(PREVIEW_CANVAS_CSS);
    expect(canvasMotionCss(true, true)).toBe(PREVIEW_CANVAS_CSS);
    expect(PREVIEW_CANVAS_CSS).toMatch(/overflow-x: hidden/);
  });
});
