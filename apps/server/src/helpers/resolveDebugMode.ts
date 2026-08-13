/**
 * Whether a render may expose debugging: the panel, element ids in the markup, the store.
 *
 * An SSR page loads the same SDK a client-rendered one does, so it follows the same rule: the page's `debugMode`
 * authorizes it (`devMode` when the server did not say otherwise), and the 'plitzi_debug' cookie is only the
 * visitor's preference within that — it exists so the SSR render matches what the client hydrates with. Being
 * client-owned, the cookie can turn debugging off, never on: otherwise any visitor of a published site could set it
 * and get the debug render.
 */
export const resolveDebugMode = (authorized: boolean | undefined, debugCookie: string | undefined): boolean =>
  Boolean(authorized) && debugCookie !== 'false';
