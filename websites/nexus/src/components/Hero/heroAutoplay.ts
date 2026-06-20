import { getControl, setControl } from './arcadeControls';

// Whether the AI should take back over after the cursor sits idle (still over the play area) for a while. Off by
// default — while the cursor is over a game you keep control, and the AI only flies once the cursor leaves. Turn it
// on for a self-playing "attract mode" demo. Backed by the Nexus controls store like every other toggle.
export const IDLE_MS = 2600;

export const setIdleAutoplay = (value: boolean) => setControl('autoIdle', value);

export const isIdleAutoplay = () => getControl('autoIdle');
