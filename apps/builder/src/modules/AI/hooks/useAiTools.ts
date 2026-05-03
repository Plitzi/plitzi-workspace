import { useCallback } from 'react';

import type { AiFrontendToolResult, AiFrontendToolRunner } from '../tools';

const useAiTools = (): AiFrontendToolRunner => {
  const runTool = useCallback(
    // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
    async (name: string, _args: Record<string, unknown>): Promise<AiFrontendToolResult> => {
      switch (name) {
        default:
          return { toolResult: { error: `Unknown client tool: ${name}` } };
      }
    },
    []
  );

  return runTool;
};

export default useAiTools;
