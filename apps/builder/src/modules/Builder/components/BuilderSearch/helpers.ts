/** ⌘P / Ctrl+P — not ⌘K, which the AI panel already takes for its conversation list. */
export const isSearchShortcut = (e: KeyboardEvent): boolean =>
  (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p';
