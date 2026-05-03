export { buildBuilderContext } from './getBuilderContext';
export type { BuilderContextResult } from './getBuilderContext';

// stage_preview is now processed in the backend
// Types are no longer needed in the frontend

export type AiFrontendToolResult = {
  // Returned to the AI via the server (keep small — no schema/style blobs)
  toolResult: unknown;
  // Client-side only: attached to the message when 'done' fires
  pendingPreview?: unknown;
};

export type AiFrontendToolRunner = (name: string, args: Record<string, unknown>) => Promise<AiFrontendToolResult>;

// Tools the server delegates to the browser client via 'client_tool' SSE events.
// Only stage_preview remains as a client tool (processed in backend but executed via client).
export const CLIENT_TOOL_NAMES = ['stage_preview'] as const;
export type ClientToolName = (typeof CLIENT_TOOL_NAMES)[number];
