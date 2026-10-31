import { useCallback, useEffect, useState } from 'react';

import { DEV_TOOLS_ATTRIBUTE } from '@plitzi/sdk-shared/devTools';

import { elementName } from './stepRecorder';

/**
 * The element the person points at on the page, for a report: the next click on the page picks it — taken before the
 * page sees it, so it neither presses anything nor counts as a step — and Escape stops pointing. A click in the dev
 * tools is theirs, and goes on.
 */
const usePointAt = (): {
  pointing: boolean;
  element?: string;
  /** The last click was on nothing of the space's — the page's margin, a plugin's own drawing: said, not taken. */
  missed: boolean;
  point: () => void;
  forget: () => void;
} => {
  const [pointing, setPointing] = useState(false);
  const [element, setElement] = useState<string | undefined>();
  const [missed, setMissed] = useState(false);

  useEffect(() => {
    if (!pointing) {
      return undefined;
    }

    const pick = (event: MouseEvent): void => {
      if (event.target instanceof Element && event.target.closest(`[${DEV_TOOLS_ATTRIBUTE}]`)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const name = elementName(event.target);
      setElement(name);
      setMissed(name === undefined);
      setPointing(false);
    };
    const stop = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setPointing(false);
      }
    };
    // On the window, in its capture: before the page — and the steps kept on the document — see the click.
    window.addEventListener('click', pick, true);
    window.addEventListener('keydown', stop, true);
    document.body.style.cursor = 'crosshair';

    return () => {
      window.removeEventListener('click', pick, true);
      window.removeEventListener('keydown', stop, true);
      document.body.style.cursor = '';
    };
  }, [pointing]);

  const point = useCallback(() => {
    setMissed(false);
    setPointing(true);
  }, []);
  const forget = useCallback(() => {
    setElement(undefined);
    setMissed(false);
  }, []);

  return { pointing, element, missed, point, forget };
};

export default usePointAt;
