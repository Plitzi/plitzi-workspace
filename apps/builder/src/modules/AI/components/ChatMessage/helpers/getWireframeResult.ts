import type { Schema, Style } from '@plitzi/sdk-shared';
import type { AiMessage } from '@pmodules/AI/types';

export type WireframeData = {
  baseElementId: string;
  name: string;
  description?: string;
  schema?: Pick<Schema, 'flat'>;
  style?: Pick<Style, 'platform' | 'cache'>;
  html?: string;
};

const getWireframeResult = (tools?: AiMessage['tools']): WireframeData | undefined => {
  if (!tools) {
    return undefined;
  }

  const wireframeTool = tools.findLast(t => t.name === 'sketch_wireframe' && t.status === 'done');
  if (!wireframeTool?.result) {
    return undefined;
  }

  const result = wireframeTool.result as Omit<WireframeData, 'html'>;

  return { ...result, html: wireframeTool.args?.html as string | undefined };
};

export default getWireframeResult;
