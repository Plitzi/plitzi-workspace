import { useCallback } from 'react';

import { transformStagePreview } from '../tools';

import type { StagePreviewArgs } from '../tools';
import type { AiFrontendToolResult, AiFrontendToolRunner } from '../tools';

const useAiTools = (): AiFrontendToolRunner => {
  const runTool = useCallback(
    // eslint-disable-next-line @typescript-eslint/require-await
    async (name: string, args: Record<string, unknown>): Promise<AiFrontendToolResult> => {
      switch (name) {
        case 'stage_preview': {
          const preview = transformStagePreview(args as StagePreviewArgs);
          return {
            toolResult: { success: true, elementCount: (args as StagePreviewArgs).elements.length },
            pendingPreview: preview
          };
        }

        default:
          return { toolResult: { error: `Unknown client tool: ${name}` } };
      }
    },
    []
  );

  return runTool;
};

export default useAiTools;
