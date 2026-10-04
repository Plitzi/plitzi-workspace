import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import useReducedMotion from './useReducedMotion';

import type { RefObject } from 'react';

/** One frame: how long the animation has run, in ms — only while it ran — the time since the last frame, and its count. */
export interface Frame {
  time: number;
  delta: number;
  frame: number;
}

export interface AnimationFrameOptions {
  /** Held still — bound to a hover, a state, a setting. */
  paused?: boolean;
  /** At most this many frames a second; every frame the screen draws when left out. */
  fps?: number;
  /** The element whose being on screen decides whether it runs: out of sight, nobody sees it move. */
  target?: RefObject<Element | null>;
}

const subscribeVisibility = (onChange: () => void): (() => void) => {
  document.addEventListener('visibilitychange', onChange);

  return () => document.removeEventListener('visibilitychange', onChange);
};

const pageShown = (): boolean => document.visibilityState !== 'hidden';

/** Whether `target` is on screen — true while it is not known (no target, no observer), which is the cautious answer. */
const useOnScreen = (target: RefObject<Element | null> | undefined): boolean => {
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const node = target?.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    const observer = new IntersectionObserver(entries => setOnScreen(entries.some(entry => entry.isIntersecting)));
    observer.observe(node);

    return () => observer.disconnect();
  }, [target]);

  return onScreen;
};

/**
 * `onFrame` on every frame the screen draws — but only while somebody can see it move: on a page that is live (not
 * edited in the builder, where a plugin is inert), for a visitor who did not ask for less motion, with the tab in front
 * and the `target` on screen, and not `paused`. Everything a canvas plugin wrote by hand, each its own way, and the
 * reason a hero animation kept a laptop's fan on behind a closed tab.
 *
 * `running` says which it is, so a plugin can draw one still frame when it is not.
 */
const useAnimationFrame = (
  onFrame: (frame: Frame) => void,
  { paused = false, fps, target }: AnimationFrameOptions = {}
): { running: boolean } => {
  const previewMode = usePlitziServiceContext().settings.previewMode ?? true;
  const reduced = useReducedMotion();
  const shown = useSyncExternalStore(subscribeVisibility, pageShown, () => false);
  const onScreen = useOnScreen(target);
  const running = previewMode && !reduced && !paused && shown && onScreen;

  const latest = useRef(onFrame);
  useEffect(() => {
    latest.current = onFrame;
  }, [onFrame]);
  // Carried across pauses, so an animation resumes where it stopped rather than jumping by the time it was hidden.
  const elapsed = useRef({ time: 0, frame: 0 });

  useEffect(() => {
    if (!running) {
      return undefined;
    }

    const interval = fps && fps > 0 ? 1000 / fps : 0;
    let handle = 0;
    let last: number | undefined;
    let owed = 0;
    const tick = (now: number): void => {
      const delta = last === undefined ? 0 : now - last;
      last = now;
      owed += delta;
      if (owed >= interval) {
        const step = interval > 0 ? owed : delta;
        owed = interval > 0 ? owed % interval : 0;
        elapsed.current = { time: elapsed.current.time + step, frame: elapsed.current.frame + 1 };
        latest.current({ ...elapsed.current, delta: step });
      }

      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(handle);
  }, [running, fps]);

  return { running };
};

export default useAnimationFrame;
