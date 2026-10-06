export const isSearchShortcut = (e: KeyboardEvent): boolean =>
  (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p';
