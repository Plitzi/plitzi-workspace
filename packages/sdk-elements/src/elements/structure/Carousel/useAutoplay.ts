import { useEffect, useRef, useState } from 'react';

import type { RefObject } from 'react';

type AutoplayOptions = {
  /** Milliseconds between moves; 0 is no autoplay. */
  delay: number;
  /** Whether it may move at all: playing, in a live page, with more than one slide. */
  active: boolean;
  rootRef: RefObject<HTMLElement | null>;
  pauseOnHover: boolean;
  /** Changes on every move, so the delay counts again from the slide just shown. */
  position: number;
  onTick: () => void;
};

/**
 * Moves a carousel on by itself — and holds still while somebody is reading it: under the pointer (when asked), with
 * keyboard focus inside it (a click's focus does not count), in a tab nobody is looking at, and always for a visitor who asked for less motion.
 */
const useAutoplay = ({ delay, active, rootRef, pauseOnHover, position, onTick }: AutoplayOptions): void => {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const tick = useRef(onTick);

  useEffect(() => {
    tick.current = onTick;
  }, [onTick]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !active) {
      return;
    }

    const enter = () => setHovered(true);
    const leave = () => setHovered(false);
    // Keyboard focus only: a click focuses the button it lands on, and pressing an arrow is no reason to stop.
    const focusIn = (event: FocusEvent) => {
      if (event.target instanceof Element && event.target.matches(':focus-visible')) {
        setFocused(true);
      }
    };
    const focusOut = (event: FocusEvent) => {
      if (!(event.relatedTarget instanceof Node) || !root.contains(event.relatedTarget)) {
        setFocused(false);
      }
    };
    root.addEventListener('pointerenter', enter);
    root.addEventListener('pointerleave', leave);
    root.addEventListener('focusin', focusIn);
    root.addEventListener('focusout', focusOut);

    return () => {
      root.removeEventListener('pointerenter', enter);
      root.removeEventListener('pointerleave', leave);
      root.removeEventListener('focusin', focusIn);
      root.removeEventListener('focusout', focusOut);
    };
  }, [rootRef, active]);

  const held = (pauseOnHover && hovered) || focused;

  useEffect(() => {
    if (!active || delay <= 0 || held || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        tick.current();
      }
    }, delay);

    return () => window.clearInterval(timer);
  }, [active, delay, held, position]);
};

export default useAutoplay;
