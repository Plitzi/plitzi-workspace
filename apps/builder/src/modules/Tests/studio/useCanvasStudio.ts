import { use, useEffect, useState } from 'react';

import { useAgentInspector } from '@plitzi/sdk-dev-tools/agentInspector';

import { changeStep, clickStep } from './stepOfEvent';
import TestStudioContext from './TestStudioContext';

import type { RefObject } from 'react';

/**
 * The canvas as the test studio uses it: handed over to play tests in, and — while a test is recorded, or a check is
 * being picked — each click on an element of the space, and each field changed, a step of it. A click that picks a
 * check reads the element and presses nothing. While open, the page's state is read and written from the canvas'
 * window (`window.__plitzi`), as a test's state steps do on any page.
 */
const useCanvasStudio = (frame: RefObject<HTMLIFrameElement | null>): void => {
  const { active: open, mode, checking, add, attach } = use(TestStudioContext);

  const [canvasWindow, setCanvasWindow] = useState<Window | null>(null);

  useEffect(() => {
    const iframe = frame.current;
    if (!open || !iframe) {
      return undefined;
    }

    attach(iframe);
    // The canvas takes its document from `srcDoc` once mounted: its window is the one it has after loading.
    const loaded = () => setCanvasWindow(iframe.contentWindow);
    loaded();
    iframe.addEventListener('load', loaded);

    return () => {
      iframe.removeEventListener('load', loaded);
      attach(null);
    };
  }, [attach, frame, open]);

  useAgentInspector(open && canvasWindow !== null, canvasWindow);

  const listening = mode === 'recording' || checking;
  useEffect(() => {
    const iframe = frame.current;
    if (!listening || !iframe) {
      return undefined;
    }

    const onClick = (event: MouseEvent): void => {
      const step = clickStep(event, checking);
      if (!step) {
        return;
      }

      // A check is read, not pressed: the page stays as it was.
      if (checking) {
        event.preventDefault();
        event.stopPropagation();
      }

      add(step);
    };
    const onChange = (event: Event): void => {
      const step = mode === 'recording' ? changeStep(event) : undefined;
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
  }, [add, checking, frame, listening, mode]);
};

export default useCanvasStudio;
