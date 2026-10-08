import { createContext } from 'react';

export type ShortcutsContextValue = {
  /** Opens the sheet listing every shortcut. */
  openHelp: () => void;
  /** Hides both side panels for the canvas alone — or, when they are hidden, brings back the ones that were open. */
  togglePanels: () => void;
};

/**
 * The canvas is an iframe, and a key pressed inside it never reaches the document the shortcuts listen on: the canvas
 * forwards the ones it sees through here, as it does ⌘P through the search.
 */
const ShortcutsContext = createContext<ShortcutsContextValue>({ openHelp: () => {}, togglePanels: () => {} });
ShortcutsContext.displayName = 'ShortcutsContext';

export default ShortcutsContext;
