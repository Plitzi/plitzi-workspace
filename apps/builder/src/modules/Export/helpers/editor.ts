/**
 * CodeMirror's wrappers take the whole height they are given, so the editor scrolls inside the viewer instead of
 * growing past it — the viewer clips, and a clipped editor cannot be scrolled at all.
 */
export const FULL_HEIGHT_EDITOR = {
  root: 'h-full min-h-0',
  inputContainer: 'h-full min-h-0 items-stretch rounded-none border-0'
};
