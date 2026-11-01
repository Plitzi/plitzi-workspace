import { useCallback, useRef, useState } from 'react';

import { journeyAccount, settle } from '@plitzi/sdk-authoring';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import { createCanvasPage } from './canvasPage';
import { canvasWaits } from './canvasWaits';
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
  const [waits] = useState(() => canvasWaits(CANVAS_MS));
  // Whether the page just drawn is still moving — sent on by its own load, as a sign-in page sends a signed-in visitor
  // to their account: kept out of sight until it is still, so what shows first is where it settles.
  const [settling, setSettling] = useState(false);
  // Which open or play is the latest: one superseded by another says nothing, and shows nothing, of its own.
  const opening = useRef(0);

  /** Draws the canvas anew and answers it once it is mounted: the page a play starts on is fresh. */
  const freshCanvas = useCallback(() => {
    const fresh = waits.wait();
    setRuntimeState({});
    setCanvasKey(key => key + 1);

    return fresh;
  }, [setRuntimeState, waits]);

  /**
   * The visitor of a flow laid over the canvas before it is drawn — its test account signed in (`as`) from the first
   * frame, or a guest — and, with none, the editor's session back. What the flow's account is not, said.
   */
  const showVisitor = useCallback(
    (flow: E2eTest | undefined): string | undefined => {
      setJourneyOnCanvas(flow !== undefined);
      const playsAs = flow ? journeyAccount(flow, space()) : {};
      setTestAccount('account' in playsAs ? playsAs.account : undefined);

      return 'problem' in playsAs ? playsAs.problem : undefined;
    },
    [setJourneyOnCanvas, setTestAccount, space]
  );

  /**
   * The canvas kept out of sight while a flow's page is drawn and sent on, until the answer is called — by the latest
   * open or play only: one superseded since leaves the canvas to it.
   */
  const conceal = useCallback(() => {
    const ticket = ++opening.current;
    setSettling(true);

    return {
      current: () => ticket === opening.current,
      reveal: () => {
        if (ticket === opening.current) {
          setSettling(false);
        }
      }
    };
  }, []);

  /**
   * A flow opened on its page and device, as its visitor: what choosing it shows before anything is played. None
   * opened: the canvas the editor's again.
   */
  const openOnCanvas = useCallback(
    async (opened: E2eTest | undefined): Promise<string | undefined> => {
      const shown = conceal();
      const problem = showVisitor(opened);
      if (!opened) {
        shown.reveal();

        return undefined;
      }

      setDisplayMode(deviceOf(opened.width));
      navigate(opened.page);
      try {
        const iframe = await freshCanvas();
        await settle(
          createCanvasPage({
            iframe,
            navigate,
            back: () => window.history.back(),
            resize: width => setDisplayMode(deviceOf(width)),
            scheme: () => undefined
          })
        );

        return problem;
      } catch (error) {
        // Said where the flow is: the canvas did not show it, and choosing it again is the way.
        return shown.current() ? (error instanceof Error ? error.message : String(error)) : undefined;
      } finally {
        shown.reveal();
      }
    },
    [conceal, freshCanvas, navigate, setDisplayMode, showVisitor]
  );

  /** The canvas' iframe, as it mounts: answered to every wait for it. */
  const attach = useCallback(
    (iframe: HTMLIFrameElement | null) => {
      canvas.current = iframe;
      if (iframe) {
        waits.mounted(iframe);
      }
    },
    [canvas, waits]
  );

  return { canvasKey, settling, conceal, freshCanvas, showVisitor, openOnCanvas, attach };
};
export default useStudioCanvas;
