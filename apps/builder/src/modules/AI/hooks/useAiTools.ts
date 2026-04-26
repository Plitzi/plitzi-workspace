import { use, useCallback } from 'react';

import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import { createStoreHook } from '@plitzi/sdk-shared/store';

import { buildBuilderContext, transformStagePreview } from '../tools';

import type { StagePreviewArgs } from '../tools';
import type { AiFrontendToolResult, AiFrontendToolRunner } from '../tools';
import type { BuilderState } from '@plitzi/sdk-shared';

const useAiTools = (): AiFrontendToolRunner => {
  const { useStore } = createStoreHook<BuilderState>();
  const [[schema, elementSelected]] = useStore(['schema', 'elementSelected']);
  const { currentPageId } = use(NavigationContext);

  const runTool = useCallback(
    async (name: string, args: Record<string, unknown>): Promise<AiFrontendToolResult> => {
      switch (name) {
        case 'stage_preview': {
          const preview = transformStagePreview(args as StagePreviewArgs);
          return {
            toolResult: { success: true, elementCount: (args as StagePreviewArgs).elements.length },
            pendingPreview: preview
          };
        }

        case 'get_builder_context': {
          const result = buildBuilderContext(schema, currentPageId, elementSelected as string | undefined);
          return { toolResult: result };
        }

        default:
          return { toolResult: { error: `Unknown client tool: ${name}` } };
      }
    },
    [schema, elementSelected, currentPageId]
  );

  return runTool;
};

export default useAiTools;
