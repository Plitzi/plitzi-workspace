import type { AiMessagePreview } from '../types';

export { transformStagePreview } from './stagePreview';
export type { PreviewElement, StagePreviewArgs, StagePreviewResult } from './stagePreview';

export { buildBuilderContext } from './getBuilderContext';
export type { BuilderContextResult } from './getBuilderContext';

export type AiFrontendToolResult = {
  // Returned to the AI via the server (kept small — no schema/style blobs)
  toolResult: unknown;
  // Client-side only: attached to the message when 'done' fires
  pendingPreview?: Extract<AiMessagePreview, { baseElementId: string }>;
};

export type AiFrontendToolRunner = (
  name: string,
  args: Record<string, unknown>
) => Promise<AiFrontendToolResult>;

// Tool names the server should delegate to the client instead of handling server-side.
// The server uses this list to emit 'client_tool' events instead of executing the tool.
export const CLIENT_TOOL_NAMES = ['stage_preview', 'get_builder_context'] as const;
export type ClientToolName = (typeof CLIENT_TOOL_NAMES)[number];
