/**
 * The read endpoint an element addresses when it names none.
 *
 * It lives here rather than beside the manifest types because it is a value, not a type: importing it from the
 * package barrel would pull the whole barrel — and plitzi-ui with it — into the server process.
 */
export const DEFAULT_READ_ENDPOINT = 'list';
