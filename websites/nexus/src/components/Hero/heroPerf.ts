import { getControl, setControl } from './arcadeControls';

// Performance mode is the `lowPerf` flag on the Nexus controls store. Low mode caps the canvas to ~30fps (skips frames
// in the rAF loop); normal mode runs uncapped (60fps). Engines read `minFrameMs()` each frame.
export const setLowPerf = (value: boolean) => setControl('lowPerf', value);

export const isLowPerf = () => getControl('lowPerf');

// Minimum milliseconds between rendered frames. 0 = uncapped (one render per rAF tick).
export const minFrameMs = () => (getControl('lowPerf') ? 1000 / 30 : 0);
