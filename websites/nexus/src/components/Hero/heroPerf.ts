// Global performance mode shared by every game loop. Low mode caps the canvas to ~30fps (skips frames in the rAF
// loop), roughly halving CPU/GPU use on weaker machines; normal mode runs uncapped (60fps). The engines read
// `minFrameMs()` each frame; the hero UI flips it.
let low = false;

export const setLowPerf = (value: boolean) => {
  low = value;
};

export const isLowPerf = () => low;

// Minimum milliseconds between rendered frames. 0 = uncapped (one render per rAF tick).
export const minFrameMs = () => (low ? 1000 / 30 : 0);
