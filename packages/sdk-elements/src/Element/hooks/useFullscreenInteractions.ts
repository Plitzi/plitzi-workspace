import { useMemo } from 'react';

import { FULLSCREEN_CALLBACKS, FULLSCREEN_MODES, toInteractionCallbacks } from '@plitzi/sdk-shared/authoring';

import type { InteractionCallback } from '@plitzi/sdk-shared';
import type { FullscreenMode } from '@plitzi/sdk-shared/authoring';
import type { RefObject } from 'react';

const modeOf = (value: unknown): FullscreenMode => FULLSCREEN_MODES.find(mode => mode === value) ?? 'toggle';

/**
 * The element's `fullscreen` step: its node on the whole screen, or back. Read when the step runs, so a node rendered
 * after the flow is wired is the one shown. A browser that cannot show it so throws, and the flow's `onFailure` runs.
 */
const useFullscreenInteractions = ({
  label,
  nodeRef
}: {
  label: string;
  nodeRef: RefObject<HTMLElement | null>;
}): Record<string, InteractionCallback> =>
  useMemo(
    () =>
      toInteractionCallbacks(
        FULLSCREEN_CALLBACKS,
        {
          fullscreen: async (params: { mode?: unknown }) => {
            const node = nodeRef.current;
            if (!node) {
              return;
            }

            const document = node.ownerDocument;
            const mode = modeOf(params.mode);
            const enter = mode === 'enter' || (mode === 'toggle' && document.fullscreenElement !== node);
            if (!enter) {
              if (document.fullscreenElement) {
                await document.exitFullscreen();
              }

              return;
            }

            if (!document.fullscreenEnabled) {
              throw new Error(`${label} cannot be shown on the whole screen here: this browser does not allow it`);
            }

            await node.requestFullscreen();
          }
        },
        { fullscreen: { title: `${label} on the whole screen` } }
      ),
    [label, nodeRef]
  );

export default useFullscreenInteractions;
