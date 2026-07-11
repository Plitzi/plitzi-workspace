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
};

export type PreviewResult =
  | { ok: true; token?: string; pagePath: string; html: string; stateVersion: string }
  | { ok: false; error: string; message: string; errors?: ValidationError[] };

/** How the MCP tools reach the renderer. The consumer injects an implementation (an HTTP client to the SSR
 *  `/preview` endpoint, or an in-process call when co-located); absent means preview is not wired. */
export type PreviewClient = {
  render: (body: PreviewRequestBody) => Promise<PreviewResult>;
};
