import { useCallback, useMemo } from 'react';

import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import type { BuilderMutationsMap, DataDraft, DataSaveResult } from '@plitzi/sdk-shared';

/** What saving answered, read from the one shape GraphQL carries it in — the three answers the platform gives. */
const saveResultOf = (answer: BuilderMutationsMap['SpaceSaveData'] | undefined): DataSaveResult | undefined => {
  if (!answer) {
    return undefined;
  }

  if (answer.ok && answer.version) {
    return { ok: true, version: answer.version };
  }

  return answer.refusal ? { ok: false, refusal: answer.refusal } : { ok: false, problems: answer.problems };
};

/**
 * The space's data draft, and saving it — through the same operation an agent's MCP and a project's `plitzi space push` end
 * in (`SpaceSaveData`): whole, against the version it was read at.
 */
const useData = () => {
  const { mutate: mutateNetwork } = useBuilderNetwork();
  const { data, error, isLoading, mutate } = useGraphQL('SpaceData', answer => answer?.SpaceData);

  const save = useCallback(
    async (files: DataDraft['files']): Promise<DataSaveResult | undefined> => {
      const response = await mutateNetwork('SpaceSaveData', { files, base: data?.version });
      const result = saveResultOf(response.result);
      if (result?.ok) {
        await mutate();
      }

      return result;
    },
    [data?.version, mutate, mutateNetwork]
  );

  return useMemo(() => ({ draft: data, error: error?.message ?? '', isLoading, save }), [data, error, isLoading, save]);
};

export default useData;
