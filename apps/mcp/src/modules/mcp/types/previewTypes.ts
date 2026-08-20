import type { ValidationError } from './aiSchema';
import type { Operation } from '../tools/operations';

// Shared I/O for the draft-preview path. Lives on the MCP side (it references the MCP write vocabulary and
// error shape); the SSR endpoint that renders a draft and the MCP tools that request one both import it here,
// so the dependency runs one way (ssr → mcp) with no cycle.

export type PreviewRequestBody = {
  spaceId: number;
  env?: string;
  pageRef?: string;
  operations?: Operation[];
  /**
   * Whether the response should carry the rendered HTML. Default true.
   *
   * Rendering it is the expensive half of a preview, and a caller on the way to a screenshot does not read it:
   * the browser fetches the same draft at `?__pt=<token>` and renders it again. `false` asks for the token and
   * the page path only — one server render instead of two. An older SSR ignores the field and still renders,
   * which costs time but never correctness.
   */
  includeHtml?: boolean;
};

export type PreviewResult =
  // `html` is empty when the request asked for `includeHtml: false` — the token and the path are what it wanted.
  | { ok: true; token?: string; pagePath: string; html: string; stateVersion: string }
  | { ok: false; error: string; message: string; errors?: ValidationError[] };

/** How the MCP tools reach the renderer. The consumer injects an implementation (an HTTP client to the SSR
 *  `/preview` endpoint, or an in-process call when co-located); absent means preview is not wired. */
export type PreviewClient = {
  render: (body: PreviewRequestBody) => Promise<PreviewResult>;
};
