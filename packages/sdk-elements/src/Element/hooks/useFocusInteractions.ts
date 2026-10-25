import { useMemo } from 'react';

import { FOCUS_CALLBACKS, toInteractionCallbacks } from '@plitzi/sdk-shared/authoring';

import type { InteractionCallback } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

/** What takes the keyboard's focus: a field, a button, a link, anything given a place in the tab order. */
const FOCUSABLE =
  'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/**
 * The element's `focus` step: the node itself when it takes focus, else the first of its descendants that does — a
 * form control's input sits inside its wrapper. Read when the step runs, so a node rendered after the flow is wired is
 * the one focused.
 */
const useFocusInteractions = ({
  label,
  nodeRef
}: {
  label: string;
  nodeRef: RefObject<HTMLElement | null>;
}): Record<string, InteractionCallback> =>
  useMemo(
    () =>
      toInteractionCallbacks(
        FOCUS_CALLBACKS,
        {
          focus: () => {
            const node = nodeRef.current;
            const target = node?.matches(FOCUSABLE) ? node : node?.querySelector<HTMLElement>(FOCUSABLE);
            (target ?? node)?.focus();
          }
        },
        { focus: { title: `Focus ${label}` } }
      ),
    [label, nodeRef]
  );

export default useFocusInteractions;
