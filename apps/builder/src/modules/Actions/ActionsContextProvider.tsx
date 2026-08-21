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

/**
 * Loads the space's server actions and the catalog of steps they can be built from.
 *
 * The catalog comes from the SERVER, not from a list in this repo: registering a task in a deployment is what
 * publishes it, so a self-hoster's own step shows up in their editor with no fork. It also means a deployment
 * without, say, a mail transport never offers a step whose only possible outcome is failure.
 */
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
  // What a step can NAME, never what it holds: the panel offers the list so nobody has to remember an identifier,
  // and the secret behind it stays where it always was. Asked for in one page, because a picker that silently
  // stops at the server's default of ten is a credential an author cannot choose.
  const { data: credentials = emptyCredentials } = useGraphQL(
    'SpaceCredentials',
    data => data?.SpaceCredentials.edges,
    { pageSize: 100 }
  );
  // An action is worthless without a server to run it, and the space only has one when something it deploys to can
  // run server code. Read off the deployments rather than a flag, so the panel cannot claim otherwise.
  const { data: deployments } = useGraphQL('SpaceDeployments', data => data?.SpaceDeployments.edges);

  const actions = useMemo(() => byIdentifier(data), [data]);
  /**
   * What the space can run, published to the store the editor's own steps read.
   *
   * A `runServerAction` step used to ask for the identifier as free text — a value this panel already had, that
   * the author had to go and look up. The step is registered by the SDK runtime, so this is how it learns: the
   * same route `navigate` takes to the page list. Identifiers and names, plus what the `call` trigger declares it
   * takes; never the flow, which is server-side state and stays on the server.
   */
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
  // Unknown counts as "has one": the deployments arrive a moment after the panel does, and a space that is set up
  // correctly should not flash a warning telling its owner it is broken.
  const hasServerRendering = useMemo(
    () => deployments === undefined || deployments.some(deployment => deployment.credential?.provider === 'ssr'),
    [deployments]
  );

  /**
   * The origins this space answers on, for the one thing an author cannot derive: a webhook's URL.
   *
   * Every deployment gets its own, because a sender is configured per environment — the staging integration must
   * not deliver into production, and a single "the URL" would invite exactly that.
   */
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

  // Both halves of what an editor needs to author a call: which actions exist, and whether anything will ever run
  // them. The second is what lets a step say so while it is being authored rather than at the first click in
  // production.
  useCommonStoreSync(['actions.catalog', 'actions.available'], [catalog, hasServerRendering]);

  const addAction = useCallback(
    async (name: string, document: ActionDocument) => {
      const response = await mutateNetwork('SpaceAddAction', { name, document });
      // Revalidating rather than merging the payload in: the list is a query, and one owner for it means a create
      // that succeeded server-side can never leave the panel showing something else.
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
