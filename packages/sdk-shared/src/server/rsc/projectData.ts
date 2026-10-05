/**
 * Where a project's own data answers: a provider whose `query` is `/data/<file>` reads `<file>` from the folder the
 * server keeps it in (`dataDir`), which is never served — so only a provider resolved on the server reads it. The
 * server's resolver and the authoring check that refuses a browser read hold the same prefix.
 */
export const PROJECT_DATA_PREFIX = '/data/';
