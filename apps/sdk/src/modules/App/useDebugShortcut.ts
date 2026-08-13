import { useCallback, useEffect } from 'react';

export type UseDebugShortcutProps = {
  /** The page's own authorization — the `debugMode` the SDK was mounted with, never anything the visitor can set. */
  authorized: boolean;
  onToggle: () => void;
};

/**
 * shift+F12 shows or hides the dev tools on a page that was already allowed to show them; it cannot grant that
 * permission. The environment is deliberately not part of the rule — whoever mounts the SDK may well want to debug a
 * production space — but a visitor of a site that never asked for debugging must not reach the panel, the element
 * ids or the store by knowing the shortcut.
 */
const useDebugShortcut = ({ authorized, onToggle }: UseDebugShortcutProps) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'F12') {
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
