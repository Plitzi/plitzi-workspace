import { getControl, setControl, toggleControl, useControl } from './arcadeControls';

// Pause is just the `paused` flag on the Nexus controls store. Canvas loops read `isPaused()` each frame and freeze
// both physics AND rendering (so a paused game stops touching the GPU); the toggle is a real store write, logged.
export const setPaused = (value: boolean) => setControl('paused', value);

export const togglePaused = () => toggleControl('paused');

export const isPaused = () => getControl('paused');

export const usePaused = (): boolean => useControl('paused');
