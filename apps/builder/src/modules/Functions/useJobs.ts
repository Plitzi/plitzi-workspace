import { CombinedGraphQLErrors } from '@apollo/client/core';
import { useCallback, useMemo } from 'react';

import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import { isJobMoving } from './helpers';

import type { JobControlAction, SpaceJob } from '@plitzi/sdk-shared';
import type { BuilderQueriesMap } from '@plitzi/sdk-shared/network';

/** Read again this often while one of the jobs shown may still move by itself, and this often while none can. */
const MOVING_MS = 2000;
const STILL_MS = 15_000;

const PAGE_SIZE = 10;

const EMPTY: SpaceJob[] = [];

const refreshOf = (latest?: BuilderQueriesMap['SpaceJobs']): number =>
  latest?.SpaceJobs.edges.some(isJobMoving) ? MOVING_MS : STILL_MS;

const CONFIG = { refreshInterval: refreshOf };

/** What a control that changed nothing answered, in the Queue's own words. */
const messageOf = (error: string | Error | undefined): string => {
  if (CombinedGraphQLErrors.is(error)) {
    return error.errors.map(each => each.message).join(' ');
  }

  if (error instanceof Error) {
    return error.message;
  }

  return error ?? 'Nothing changed';
};

/**
 * The space's runs of one of its functions' jobs, newest first — read again every few seconds while one may still move —
 * and the Queue's controls over each, through the same operations the dashboard's Queue reaches over REST.
 */
const useJobs = (name: string) => {
  const { mutate: mutateNetwork } = useBuilderNetwork();
  const variables = useMemo(() => ({ kind: 'function', name, pageSize: PAGE_SIZE }), [name]);
  const { data, error, isLoading, mutate } = useGraphQL(
    name ? 'SpaceJobs' : null,
    answer => answer?.SpaceJobs,
    variables,
    CONFIG
  );

  /** Answers why nothing changed, or nothing when it did. */
  const control = useCallback(
    async (jobId: string, action: JobControlAction): Promise<string | undefined> => {
      const answer = await mutateNetwork('SpaceControlJob', { jobId, control: action }, true);
      await mutate();

      return answer.success ? undefined : messageOf(answer.error);
    },
    [mutate, mutateNetwork]
  );

  return useMemo(
    () => ({
      jobs: data?.edges ?? EMPTY,
      total: data?.pageInfo.total ?? 0,
      error: error?.message ?? '',
      isLoading,
      control
    }),
    [control, data, error, isLoading]
  );
};

export default useJobs;
