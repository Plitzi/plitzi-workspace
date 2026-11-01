import { useCallback, useEffect } from 'react';

/** Whether a pointer is held down anywhere on the page: what a blur caused by pressing something else looks like. */
let pressed = false;
let listening = false;

const release = (): void => {
  pressed = false;
};

/** Listens for presses once per page, from the first control mounted: the press that blurs a field comes before it. */
const listenForPresses = (): void => {
  if (listening || typeof document === 'undefined') {
    return;
  }

  listening = true;
  document.addEventListener(
    'pointerdown',
    () => {
      pressed = true;
    },
    true
  );
  document.addEventListener('pointerup', release, true);
  document.addEventListener('pointercancel', release, true);
};

/**
 * `run` now — or, when a press is what took the focus away, once that press has landed (its `click` included).
 *
 * A field checked as it loses focus says its error under itself, and what is below it moves down. When the focus left
 * because something below was pressed, it moved between the press and the release, and the click landed on whatever
 * slid under the pointer: a box ticked after a wrong confirmation stayed unticked. Left by the keyboard, nothing is held,
 * and it is checked at once.
 */
export const afterPress = (run: () => void): void => {
  if (!pressed || typeof document === 'undefined') {
    run();

    return;
  }

  const landed = (): void => {
    document.removeEventListener('pointerup', landed, true);
    document.removeEventListener('pointercancel', landed, true);
    // After the click the release starts, which the browser dispatches in the same task.
    setTimeout(run, 0);
  };
  document.addEventListener('pointerup', landed, true);
  document.addEventListener('pointercancel', landed, true);
};

/** A form control's blur, checking its field — after the press that took the focus, if one did ({@link afterPress}). */
const useBlurValidation = (onValidate?: () => void): (() => void) => {
  useEffect(listenForPresses, []);

  return useCallback(() => afterPress(() => onValidate?.()), [onValidate]);
};

export default useBlurValidation;
