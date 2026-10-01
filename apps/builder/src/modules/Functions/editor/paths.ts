/**
 * Where the worker keeps the space's files. Its own module, with nothing imported: the panel needs these paths, and
 * `source.ts` beside them brings the TypeScript compiler, which belongs to the worker alone — imported from the panel it
 * landed in the builder's bundle, and broke rendering the builder on the server.
 */

/** The root the worker keeps the space's files under — `/functions/lib/feed.ts` is `lib/feed.ts` to the panel. */
export const FUNCTIONS_ROOT = '/functions/';

/** Where a file of the space's functions lives in the worker. */
export const workerPathOf = (file: string): string => `${FUNCTIONS_ROOT}${file}`;
