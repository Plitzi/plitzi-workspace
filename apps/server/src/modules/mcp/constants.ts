// Query param carrying a one-shot draft-preview token. A normal render sees it, resolves the stashed draft
// offline-data from the draft store, and renders that instead of the persisted state. Shared by the SSR render
// path (reads it) and the MCP screenshot client (appends it), so it lives in one neutral runtime module.
export const PREVIEW_TOKEN_PARAM = '__pt';
