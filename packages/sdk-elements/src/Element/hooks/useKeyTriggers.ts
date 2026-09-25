import { useEffect, useMemo } from 'react';

import { KEY_TRIGGER, keyPressCombo, parseKeys } from '@plitzi/sdk-shared/helpers/keys';

import type { InteractionsManager } from '@plitzi/sdk-interactions';
import type { ElementInteraction } from '@plitzi/sdk-shared';
import type { KeyTriggerPayload } from '@plitzi/sdk-shared/helpers/keys';

/** Where a key press is somebody typing, not a shortcut. */
const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(EDITABLE) !== null;

const isMac = (): boolean => /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

export type UseKeyTriggersProps = {
  id: string;
  interactions?: Record<string, ElementInteraction>;
  previewMode: boolean;
  interactionsManager: InteractionsManager;
};

/**
 * The element's keyboard shortcuts: its `onKey` flows, heard on the window for as long as it is mounted.
 *
 * On the window rather than the element, because a shortcut is for the page — nobody focuses a map before pressing
 * `+`. A press while typing in a field is the field's, unless it holds Ctrl, ⌘ or Alt or is Escape. A press that
 * matches is the shortcut's alone: the browser's own use of the key (an arrow scrolling the page) does not happen.
 */
const useKeyTriggers = ({ id, interactions, previewMode, interactionsManager }: UseKeyTriggersProps): void => {
  const specs = useMemo(
    () => [
      ...new Set(
        Object.values(interactions ?? {}).flatMap(node => {
          const { keys } = node.params;

          return node.type === 'trigger' && node.action === KEY_TRIGGER && node.enabled && typeof keys === 'string'
            ? [keys]
            : [];
        })
      )
    ],
    [interactions]
  );

  useEffect(() => {
    if (!previewMode || !specs.length) {
      return undefined;
    }

    const mac = isMac();
    const listening = specs.map(spec => ({ spec, combos: parseKeys(spec, mac).combos }));
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.isComposing) {
        return;
      }

      const key = keyPressCombo(event);
      const held = event.ctrlKey || event.metaKey || event.altKey;
      if (isTyping(event.target) && !held && key !== 'escape') {
        return;
      }

      const shortcuts = listening.filter(entry => entry.combos.includes(key)).map(entry => entry.spec);
      if (!shortcuts.length) {
        return;
      }

      event.preventDefault();
      const payload: KeyTriggerPayload = { key, shortcuts };
      void interactionsManager.interactionTrigger(id, KEY_TRIGGER, payload);
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [id, interactionsManager, previewMode, specs]);
};

export default useKeyTriggers;
