import { use, useEffect } from 'react';

import { changeStep, clickStep } from './stepOfEvent';
import TestsRecordingContext from './TestsRecordingContext';

import type { RefObject } from 'react';

/**
 * The canvas recording an e2e test's steps while one is recorded: each click on an element of the space, and each field
 * changed, a step — a click while expecting holds what the element shows instead, and presses nothing.
 */
const useCanvasRecording = (frame: RefObject<HTMLIFrameElement | null>): void => {
  const { recording, expecting, add } = use(TestsRecordingContext);

  useEffect(() => {
    const iframe = frame.current;
    if (!recording || !iframe) {
      return undefined;
    }

    const onClick = (event: MouseEvent): void => {
      const step = clickStep(event, expecting);
      if (!step) {
        return;
      }

      // What is expected is read, not pressed: the page stays as it was.
      if (expecting) {
        event.preventDefault();
        event.stopPropagation();
      }

      add(step);
    };
    const onChange = (event: Event): void => {
      const step = changeStep(event);
      if (step) {
        add(step);
      }
    };

    // The canvas takes its document from `srcDoc` once mounted — leaving the Tests view mounts it anew — so the
    // listeners follow the document the iframe has, not the one it had when the recording started.
    let listened: Document | undefined;
    const unlisten = (): void => {
      listened?.removeEventListener('click', onClick, true);
      listened?.removeEventListener('change', onChange, true);
      listened = undefined;
    };
    const listen = (): void => {
      unlisten();
      listened = iframe.contentDocument ?? undefined;
      listened?.addEventListener('click', onClick, true);
      listened?.addEventListener('change', onChange, true);
    };
    listen();
    iframe.addEventListener('load', listen);

    return () => {
      iframe.removeEventListener('load', listen);
      unlisten();
    };
  }, [add, expecting, frame, recording]);
};

export default useCanvasRecording;
