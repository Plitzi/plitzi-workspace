import type { Schema, Style } from '@plitzi/sdk-shared';
import type { AiMessage } from '@pmodules/AI/types';

export type PreviewData = {
  baseElementId: string;
  schema?: Pick<Schema, 'flat'>;
  style?: Pick<Style, 'platform' | 'cache'>;
  elements?: Array<Record<string, unknown>>;
  html?: string;
};

const getStagePreviewResult = (tools?: AiMessage['tools']): PreviewData | undefined => {
  if (!tools) {
    return undefined;
  }

  const stagePreviewTool = tools.findLast(t => t.name === 'stage_preview' && t.status === 'done');
  if (!stagePreviewTool?.result) {
    return undefined;
  }

  const result = stagePreviewTool.result as Omit<PreviewData, 'html'>;

  return { ...result, html: stagePreviewTool.args?.html as string | undefined };
};

export default getStagePreviewResult;
