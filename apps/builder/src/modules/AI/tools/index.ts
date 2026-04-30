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

export type AiFrontendToolRunner = (name: string, args: Record<string, unknown>) => Promise<AiFrontendToolResult>;

// Tools the server delegates to the browser client via 'client_tool' SSE events.
// get_builder_context executes server-side; only stage_preview needs client-side SDK access.
export const CLIENT_TOOL_NAMES = ['stage_preview'] as const;
export type ClientToolName = (typeof CLIENT_TOOL_NAMES)[number];
