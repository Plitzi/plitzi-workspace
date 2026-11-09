import { sharedContext } from './sharedContext';

/**
 * True under a space: what a space drawn inside it — the `plitziSdk` element, a plugin rendering a space of its own —
 * reads to know the document is not its own. The space itself keeps the answer in `render.enclosed`, where everything
 * in it reads it; this context is only how it learns it.
 *
 * Shared, because the space around may be another copy of the runtime: a plugin imports the SDK through the page's
 * import map.
 */
export const EnclosingSpaceContext = sharedContext<boolean>('EnclosingSpaceContext', false);
