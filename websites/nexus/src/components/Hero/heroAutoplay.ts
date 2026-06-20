// Whether the AI should take back over after the cursor sits idle (still over the play area) for a while. Off by
// default — while the cursor is over a game you keep control, and the AI only flies once the cursor leaves. Turn it
// on for a self-playing "attract mode" demo.
let idle = false;

export const IDLE_MS = 2600;

export const setIdleAutoplay = (value: boolean) => {
  idle = value;
};

export const isIdleAutoplay = () => idle;
