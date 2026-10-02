export const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

/** The modifier a shortcut is written with on this machine: the command key on a Mac, Control everywhere else. */
export const modifierKey = isMac ? '⌘' : 'Ctrl';

/** A shortcut as this machine writes it: `⌘C` on a Mac, `Ctrl+C` everywhere else. */
export const withModifier = (key: string): string => (isMac ? `${modifierKey}${key}` : `${modifierKey}+${key}`);

/** The key that removes what is selected, as its keycap reads. */
export const deleteKey = isMac ? '⌫' : 'Del';
