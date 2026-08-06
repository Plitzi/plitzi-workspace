// Query param carrying a one-shot draft-preview token. A normal render sees it, resolves the stashed draft
// offline-data from the draft store, and renders that instead of the persisted state. Shared by the SSR render
// path (reads it) and sdk-mcp's screenshot client (appends it) — two packages now, so it sits in the kernel:
// the only module both can reach without either depending on the other's render path.
export const PREVIEW_TOKEN_PARAM = '__pt';
