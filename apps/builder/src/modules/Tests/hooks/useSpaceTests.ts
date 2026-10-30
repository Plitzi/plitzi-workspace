import { use, useCallback, useEffect, useRef } from 'react';

import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';
import QueueStatusContext from '@pmodules/Queue/QueueStatusContext';

import type { SpaceTests } from '@plitzi/sdk-shared';
import type { TSpaceRunE2eTestsMutation, TSpaceTests } from '@plitzi/sdk-shared/network';

/** The document being edited: a published snapshot was tested when it was taken, and cannot change. */
const VARIABLES = { environment: 'main' };

/**
 * The space's tests as the saved document keeps them, and how they stand against it — what a snapshot would meet. Asked
 * again each time the save queue drains, as the issues are: an edit of the space is what makes a test pass or fail.
 * `save` stores the list whole and answers how it stands, or what was wrong with it.
 */
export type SpaceTestsState = {
  answer: TSpaceTests | undefined;
  isLoading: boolean;
  save: (tests: SpaceTests) => Promise<{ ok: true } | { ok: false; problem: string }>;
  /** The e2e tests played now on the saved draft, by the server: each as it went, or why none was run. */
  runE2e: () => Promise<TSpaceRunE2eTestsMutation | { notRun: string; results: [] }>;
};

const useSpaceTests = (): SpaceTestsState => {
  const processing = use(QueueStatusContext);
  const { mutate: mutateNetwork } = useBuilderNetwork();
  const { data, isLoading, mutate } = useGraphQL('SpaceTests', undefined, VARIABLES, {
    revalidateOnFocus: false
  });
  const wasProcessing = useRef(processing);

  useEffect(() => {
    if (wasProcessing.current && !processing) {
      void mutate();
    }

    wasProcessing.current = processing;
  }, [processing, mutate]);

  const save = useCallback(
    async (tests: SpaceTests): Promise<{ ok: true } | { ok: false; problem: string }> => {
      const response = await mutateNetwork('SpaceSetTests', { ...VARIABLES, tests });
      if (!response.success) {
        const problem = response.error instanceof Error ? response.error.message : response.error;

        return { ok: false, problem: problem || 'The tests could not be saved.' };
      }

      await mutate();

      return { ok: true };
    },
    [mutate, mutateNetwork]
  );

  const runE2e = useCallback(async () => {
    const response = await mutateNetwork('SpaceRunE2eTests', {});
    if (!response.success || !response.result) {
      const problem = response.error instanceof Error ? response.error.message : response.error;

      return { notRun: problem || 'The e2e tests could not be run.', results: [] as [] };
    }

    return response.result;
  }, [mutateNetwork]);

  return { answer: data?.SpaceTests ?? undefined, isLoading, save, runE2e };
};

export default useSpaceTests;
