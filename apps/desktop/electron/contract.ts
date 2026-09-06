/**
 * What the two processes agree on, in the one file both of them import.
 *
 * The preload is bundled separately from the main process and from the renderer, so a channel name or a scheme
 * written out in each of them is three copies of one string that only disagree at runtime — as a bridge that
 * silently answers nothing.
 */

export const APP_SCHEME = 'plitzi-app';

/** The renderer's origin in a packaged build. Add it to the deployment's `PLATFORM_ORIGINS`. */
export const APP_ORIGIN = `${APP_SCHEME}://home`;

export const STORE_CHANNEL = 'plitzi:session-store';

export type StoreRequest = { action: 'read' } | { action: 'write'; value: string } | { action: 'clear' };
