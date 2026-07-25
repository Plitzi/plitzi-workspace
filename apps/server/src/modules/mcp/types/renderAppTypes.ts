// Where the MCP Apps render view loads the Plitzi SDK from. The view is HTML the host renders in a sandboxed
// iframe on ITS OWN origin, so these must be ABSOLUTE URLs pointing back at a server that serves
// @plitzi/plitzi-sdk/dist — the MCP stage builds them per request from the request's own origin.
export type SdkAssetUrls = {
  /** The SDK ESM bundle: the import map's '@plitzi/plitzi-sdk' entry. */
  js: string;
  /** The SDK stylesheet. */
  css: string;
  /** The React vendor bundle every `react*` bare specifier maps to (the dev or the prod build). */
  vendor: string;
};
