import { useCallback, useMemo } from 'react';

import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import type { ActionRunReport, BuilderMutationsMap, FunctionsDraft, FunctionsSaveResult } from '@plitzi/sdk-shared';

/** What saving answered, read from the one shape GraphQL carries it in — the three answers the platform gives. */
const saveResultOf = (
  answer: BuilderMutationsMap['SpaceSaveFunctions' | 'SpaceInstallTemplateFunctions'] | undefined
): FunctionsSaveResult | undefined => {
  if (!answer) {
    return undefined;
  }

  if (answer.ok && answer.version && answer.manifest) {
    return { ok: true, version: answer.version, manifest: answer.manifest };
  }

  return answer.refusal ? { ok: false, refusal: answer.refusal } : { ok: false, problems: answer.problems };
};

/**
 * The space's functions draft, and the three things the panel does to it — save, remove, try — through the same
 * operations a project's CLI and an agent use (`SpaceSaveFunctions`, `SpaceRemoveFunctions`, `SpaceTryFunction`).
 */
const useFunctions = () => {
  const { mutate: mutateNetwork } = useBuilderNetwork();
  const { data, error, isLoading, mutate } = useGraphQL('SpaceFunctions', answer => answer?.SpaceFunctions);

  const save = useCallback(
    async (files: FunctionsDraft['files']): Promise<FunctionsSaveResult | undefined> => {
      const response = await mutateNetwork('SpaceSaveFunctions', { files, base: data?.version });
      const result = saveResultOf(response.result);
      if (result?.ok) {
        await mutate();
      }

      return result;
    },
    [data?.version, mutate, mutateNetwork]
  );

  const install = useCallback(async (): Promise<FunctionsSaveResult | undefined> => {
    const result = saveResultOf((await mutateNetwork('SpaceInstallTemplateFunctions', {})).result);
    if (result?.ok) {
      await mutate();
    }

    return result;
  }, [mutate, mutateNetwork]);

  const remove = useCallback(async () => {
    await mutateNetwork('SpaceRemoveFunctions', {});
    await mutate();
  }, [mutate, mutateNetwork]);

  const tryTask = useCallback(
    async (task: string, params: Record<string, unknown>): Promise<ActionRunReport | undefined> =>
      (await mutateNetwork('SpaceTryFunction', { task, params })).result,
    [mutateNetwork]
  );

  return useMemo(
    () => ({ draft: data, error: error?.message ?? '', isLoading, save, install, remove, tryTask }),
    [data, error, isLoading, save, install, remove, tryTask]
  );
};

export default useFunctions;
