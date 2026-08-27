import { useCallback, use, useMemo } from 'react';

import { actionTriggers, triggerInput } from '@plitzi/sdk-shared/actions';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { useCommonStoreSync } from '@plitzi/sdk-shared/store';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import ActionsContext from './ActionsContext';

import type { ActionsContextValue } from './ActionsContext';
import type {
  ActionCatalogEntry,
  ActionDocument,
  ActionTaskDescriptor,
  ActionTriggerType,
  BuilderMutationsMap,
  BuilderQueriesMap,
  SpaceAction,
  SpaceCredential
} from '@plitzi/sdk-shared';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';
import type { ReactNode } from 'react';

export type ActionsContextProviderProps = {
  children: ReactNode;
};

const emptyActions: SpaceAction[] = [];
const emptyTasks: ActionTaskDescriptor[] = [];
const emptyCredentials: SpaceCredential[] = [];

const byIdentifier = (actions: SpaceAction[]) =>
  actions.reduce<Record<string, SpaceAction>>((acum, action) => {
    acum[action.identifier] = action;

    return acum;
  }, {});

const ActionsContextProvider = ({ children }: ActionsContextProviderProps) => {
  const { mutate: mutateNetwork } = use(NetworkContext) as BuilderNetworkContextValue<
    BuilderQueriesMap,
    BuilderMutationsMap
  >;
  const {
    data = emptyActions,
    error,
    isLoading,
    mutate
  } = useGraphQL('SpaceActions', data => data?.SpaceActions.edges, { pageSize: 100 });
  const { data: tasks = emptyTasks } = useGraphQL('SpaceActionTasks', data => data?.SpaceActionTasks);
  // Full page size: a picker silently capped at the server default would hide credentials.
  const { data: credentials = emptyCredentials } = useGraphQL(
    'SpaceCredentials',
    data => data?.SpaceCredentials.edges,
    { pageSize: 100 }
  );
  const { data: deployments } = useGraphQL('SpaceDeployments', data => data?.SpaceDeployments.edges);

  const actions = useMemo(() => byIdentifier(data), [data]);
  /** Published for the SDK runtime's runServerAction steps; never includes the flow itself. */
  const catalog = useMemo<ActionCatalogEntry[]>(
    () =>
      data.map(action => {
        const trigger = actionTriggers(action.document).find(node => node.action === 'call');

        return {
          identifier: action.identifier,
          name: action.name,
          input: trigger ? triggerInput(trigger.params) : {}
        };
      }),
    [data]
  );
  // Unknown counts as true: deployments arrive after the panel mounts.
  const hasServerRendering = useMemo(
    () => deployments === undefined || deployments.some(deployment => deployment.credential?.provider === 'ssr'),
    [deployments]
  );

  /** One per deployment, for building webhook URLs. */
  const origins = useMemo(
    () =>
      (deployments ?? [])
        .filter(deployment => deployment.domain)
        .map(deployment => ({
          environment: deployment.environment,
          domain: deployment.domain,
          isDefault: deployment.default
        })),
    [deployments]
  );

  useCommonStoreSync(['actions.catalog', 'actions.available'], [catalog, hasServerRendering]);

  const addAction = useCallback(
    async (name: string, document: ActionDocument) => {
      const response = await mutateNetwork('SpaceAddAction', { name, document });
      await mutate();

      return response.result;
    },
    [mutate, mutateNetwork]
  );

  const updateAction = useCallback(
    async (identifier: string, name: string, document: ActionDocument) => {
      const response = await mutateNetwork('SpaceUpdateAction', { identifier, name, document });
      await mutate();

      return response.result;
    },
    [mutate, mutateNetwork]
  );

  const removeAction = useCallback(
    async (identifier: string) => {
      const response = await mutateNetwork('SpaceRemoveAction', { identifier });
      await mutate();

      return Boolean(response.result);
    },
    [mutate, mutateNetwork]
  );

  const runAction = useCallback(
    async (identifier: string, input: Record<string, unknown>, trigger: ActionTriggerType = 'call') => {
      const response = await mutateNetwork('SpaceRunAction', { identifier, input, trigger });

      return response.result;
    },
    [mutateNetwork]
  );

  const value = useMemo<ActionsContextValue>(
    () => ({
      actions,
      tasks,
      credentials,
      isLoading,
      error: error?.message ?? '',
      hasServerRendering,
      deployments: origins,
      addAction,
      updateAction,
      removeAction,
      runAction
    }),
    [
      actions,
      tasks,
      credentials,
      isLoading,
      error,
      hasServerRendering,
      origins,
      addAction,
      updateAction,
      removeAction,
      runAction
    ]
  );

  return <ActionsContext value={value}>{children}</ActionsContext>;
};

export default ActionsContextProvider;
