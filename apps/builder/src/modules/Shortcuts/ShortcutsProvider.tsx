import { usePopup } from '@plitzi/plitzi-ui/Popup';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import ShortcutsHelp from './components/ShortcutsHelp';
import { isHelpShortcut, isPanelsShortcut } from './helpers';
import ShortcutsContext from './ShortcutsContext';

import type { ShortcutsContextValue } from './ShortcutsContext';
import type { ReactNode } from 'react';

export type ShortcutsProviderProps = {
  children?: ReactNode;
};

type HiddenPanels = { left: string[]; right: string[] };

/**
 * The builder's own shortcuts — the ones that act on the workspace rather than on the canvas: the help sheet and the
 * side panels. Inside the popup provider, whose panels it hides and brings back.
 */
const ShortcutsProvider = ({ children }: ShortcutsProviderProps) => {
  const [helpOpen, setHelpOpen] = useState(false);
  const left = usePopup('left');
  const right = usePopup('right');
  // What was open when the panels were hidden, so the same toggle brings back exactly that.
  const hiddenRef = useRef<HiddenPanels | undefined>(undefined);

  const openHelp = useCallback(() => setHelpOpen(true), []);

  const handleCloseHelp = useCallback(() => setHelpOpen(false), []);

  const togglePanels = useCallback(() => {
    // Anything open is hidden, even a panel opened by hand after the last hide: the toggle never fights the person.
    if (left.popupActiveIds.length || right.popupActiveIds.length) {
      hiddenRef.current = { left: left.popupActiveIds, right: right.popupActiveIds };
      left.popupManager.setActiveMany([], 'left');
      right.popupManager.setActiveMany([], 'right');

      return;
    }

    if (!hiddenRef.current) {
      return;
    }

    left.popupManager.setActiveMany(hiddenRef.current.left, 'left');
    right.popupManager.setActiveMany(hiddenRef.current.right, 'right');
    hiddenRef.current = undefined;
  }, [left, right]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isPanelsShortcut(e)) {
        e.preventDefault();
        togglePanels();

        return;
      }

      if (isHelpShortcut(e)) {
        e.preventDefault();
        setHelpOpen(state => !state);
      }
    },
    [togglePanels]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const value = useMemo<ShortcutsContextValue>(() => ({ openHelp, togglePanels }), [openHelp, togglePanels]);

  return (
    <ShortcutsContext value={value}>
      {children}
      <ShortcutsHelp open={helpOpen} onClose={handleCloseHelp} />
    </ShortcutsContext>
  );
};

export default ShortcutsProvider;
