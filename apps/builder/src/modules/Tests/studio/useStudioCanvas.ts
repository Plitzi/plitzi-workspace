import { useCallback, useRef, useState } from 'react';

import { journeyAccount } from '@plitzi/sdk-authoring';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import { deviceOf } from './flowPlay';

import type { DisplayMode, E2eTest, Schema } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

/** How long a canvas drawn anew is waited for before a play gives up on it. */
const CANVAS_MS = 15_000;

/**
 * The canvas of the Tests view: drawn anew for each flow, as a new visitor's page, and showing the visitor of the flow
 * on it — its test account signed in (`as`) or a guest, never the editor's session (`journeyOnCanvas`, `JourneyVisitor`).
 */
const useStudioCanvas = ({
  canvas,
  navigate,
  setDisplayMode,
  space
}: {
  /** Where the canvas' iframe is kept, once mounted: what a play's spotlight reads. */
  canvas: RefObject<HTMLIFrameElement | null>;
  navigate: (path: string) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  /** The document a flow is opened against, its tests as they stand in the area: where its account is declared. */
  space: () => Schema;
}) => {
  const [, setRuntimeState] = useBuilderStore('runtime.state');
  const [, setJourneyOnCanvas] = useBuilderStore('journeyOnCanvas');
  const [, setTestAccount] = useBuilderStore('runtime.testAccount');
  const [canvasKey, setCanvasKey] = useState(0);
  const awaitingCanvas = useRef<((iframe: HTMLIFrameElement) => void) | undefined>(undefined);
  // Which opening is the latest: one superseded by another flow chosen leaves the canvas to it.
  const opening = useRef(0);

  /** Draws the canvas anew and answers it once it is mounted: the page a play starts on is fresh. */
  const freshCanvas = useCallback(
    () =>
      new Promise<HTMLIFrameElement>((resolve, reject) => {
        const late = setTimeout(() => {
          awaitingCanvas.current = undefined;
          reject(new Error('The page on the left did not show again in time: choose the journey again.'));
        }, CANVAS_MS);
        awaitingCanvas.current = iframe => {
          clearTimeout(late);
          resolve(iframe);
        };
        setRuntimeState({});
        setCanvasKey(key => key + 1);
      }),
    [setRuntimeState]
  );

  /**
   * A flow opened on its page and device, as its visitor — a new one, or its test account signed in (`as`) from the
   * first frame: what choosing it shows before anything is played. None opened: the canvas the editor's again.
   */
  const openOnCanvas = useCallback(
    async (opened: E2eTest | undefined): Promise<string | undefined> => {
      const ticket = ++opening.current;
      setJourneyOnCanvas(opened !== undefined);
      if (!opened) {
        setTestAccount(undefined);

        return undefined;
      }

      const playsAs = journeyAccount(opened, space());
      setTestAccount('account' in playsAs ? playsAs.account : undefined);
      setDisplayMode(deviceOf(opened.width));
      navigate(opened.page);
      try {
        await freshCanvas();

        return ticket === opening.current && 'problem' in playsAs ? playsAs.problem : undefined;
      } catch (error) {
        // Said where the flow is: the canvas did not show it, and choosing it again is the way.
        return error instanceof Error ? error.message : String(error);
      }
    },
    [freshCanvas, navigate, setDisplayMode, setJourneyOnCanvas, setTestAccount, space]
  );

  /** The canvas' iframe, as it mounts: answered to a play waiting for it. */
  const attach = useCallback(
    (iframe: HTMLIFrameElement | null) => {
      canvas.current = iframe;
      if (iframe && awaitingCanvas.current) {
        const answer = awaitingCanvas.current;
        awaitingCanvas.current = undefined;
        answer(iframe);
      }
    },
    [canvas]
  );

  return { canvasKey, freshCanvas, openOnCanvas, attach };
};

export default useStudioCanvas;
