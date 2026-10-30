import { useCallback } from 'react';

import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';

import type { SpaceTests } from '@plitzi/sdk-shared';

/** The document being edited: a published snapshot was tested when it was taken, and cannot change. */
export const TESTS_VARIABLES = { environment: 'main' };

export type SavedTests = { ok: true } | { ok: false; problem: string };

/** Stores the space's tests whole, answering whether they were kept — or what was wrong with them, as the server says. */
const useSaveSpaceTests = (): ((tests: SpaceTests) => Promise<SavedTests>) => {
  const { mutate: mutateNetwork } = useBuilderNetwork();

  return useCallback(
    async (tests: SpaceTests): Promise<SavedTests> => {
      const response = await mutateNetwork('SpaceSetTests', { ...TESTS_VARIABLES, tests });
      if (!response.success) {
        const problem = response.error instanceof Error ? response.error.message : response.error;

        return { ok: false, problem: problem || 'The tests could not be saved.' };
      }

      return { ok: true };
    },
    [mutateNetwork]
  );
};

export default useSaveSpaceTests;
