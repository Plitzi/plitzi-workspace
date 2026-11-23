/**
 * A space's console in the platform it was opened from (`/spaces/split-roast`): by the name its address carries, as the
 * console's own links say it, and by its id until the space has loaded. Where the builder goes back to — the space it
 * was opened for, not the list of every space.
 */
export const consoleUrlOf = (origin: string, permanentUrl: unknown, webId: number): string =>
  `${origin}/spaces/${encodeURIComponent(typeof permanentUrl === 'string' && permanentUrl ? permanentUrl : String(webId))}`;
