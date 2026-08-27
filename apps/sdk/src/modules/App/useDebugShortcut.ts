import { useCallback, useEffect } from 'react';

export type UseDebugShortcutProps = {
  /** The page's own authorization — the `debugMode` the SDK was mounted with, never anything the visitor can set. */
  authorized: boolean;
  onToggle: () => void;
};

/**
 * Whether the keystroke is going into somebody's writing.
 *
 * Only the letter combination needs asking: `F12` cannot be typed into a field, but `D` can, and a shortcut that
 * fires while the visitor is halfway through a word is a shortcut people turn off.
 */
const isTyping = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
};

/**
 * Shows or hides the dev tools on a page that was already allowed to show them; it cannot grant that permission.
 * The environment is deliberately not part of the rule — whoever mounts the SDK may well want to debug a
 * production space — but a visitor of a site that never asked for debugging must not reach the panel, the element
 * ids or the store by knowing the shortcut.
 *
 * **Two chords, and the second is not a convenience.** On a Mac the top row is media keys unless the visitor
 * holds `fn` or has changed a system setting, so `shift+F12` is a shortcut a good half of the people reading this
 * cannot press. `shift+alt+D` is typeable on every keyboard, which is what makes the panel actually reachable.
 */
const useDebugShortcut = ({ authorized, onToggle }: UseDebugShortcutProps) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'F12') {
        onToggle();

        return;
      }

      // `code`, not `key`: alt+D on a Mac produces '∂', and on other layouts something else again — the physical
      // key is the only thing that stays put.
      if (e.shiftKey && e.altKey && e.code === 'KeyD' && !isTyping(e.target)) {
        e.preventDefault();
        onToggle();
      }
    },
    [onToggle]
  );

  useEffect(() => {
    if (!authorized) {
      return undefined;
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [authorized, handleKeyDown]);
};

export default useDebugShortcut;
