/**
 * Whether the page is shown as a guest while a journey is on the canvas: unless its test account is laid over it, or
 * the session is no longer the editor's — one the journey signed in to, which is then what it reads.
 */
export const playsAsGuest = (
  onCanvas: boolean,
  accountLaid: boolean,
  token: string | undefined,
  editorToken: string | undefined
): boolean => onCanvas && !accountLaid && token === editorToken;
