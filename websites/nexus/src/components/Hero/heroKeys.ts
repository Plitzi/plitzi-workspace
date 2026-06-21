import { useEffect } from 'react';

// Global keyboard state for the arcade, so every game is playable without a mouse (accessibility). Listeners are
// attached only while a game is on screen and movement keys are swallowed (no page scroll). Engines poll the axes each
// frame; when an axis is live the player is driving, so the autopilot stands down.
const pressed = new Set<string>();
let refCount = 0;

const MOVE_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'a',
  'A',
  'd',
  'D',
  'w',
  'W',
  's',
  'S',
  ' '
]);

const onKeyDown = (e: KeyboardEvent) => {
  if (MOVE_KEYS.has(e.key)) {
    pressed.add(e.key);
    e.preventDefault();
  }
};

const onKeyUp = (e: KeyboardEvent) => {
  pressed.delete(e.key);
};

const attachKeys = () => {
  if (refCount === 0) {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }

  refCount += 1;
};

const detachKeys = () => {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0) {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    pressed.clear();
  }
};

const down = (...keys: string[]) => keys.some(k => pressed.has(k));

export const keyAxisX = (): number => (down('ArrowRight', 'd', 'D') ? 1 : 0) - (down('ArrowLeft', 'a', 'A') ? 1 : 0);

export const keyAxisY = (): number => (down('ArrowDown', 's', 'S') ? 1 : 0) - (down('ArrowUp', 'w', 'W') ? 1 : 0);

export const keyFire = (): boolean => down(' ');

// Mounts the global key listeners while `active`, releasing them (and clearing held keys) when the arcade is idle.
export const useArcadeKeys = (active: boolean): void => {
  useEffect(() => {
    if (!active) {
      return;
    }

    attachKeys();

    return detachKeys;
  }, [active]);
};
