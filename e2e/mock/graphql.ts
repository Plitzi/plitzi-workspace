import { plainSpace } from '../spaces';

import type { OfflineDataRaw, Style } from '@plitzi/sdk-shared';

/** The backend the builder talks to, answered in the browser.
 *
 *  This exists for one environment: CI, where there is no `plitzi-sdk-server` to talk to — no sibling repository,
 *  no databases, no certificates. Everywhere else the suite runs against the real thing, because a mock proves
 *  nothing about the server: what it returns here is what THIS FILE says, not what the server would say.
 *
 *  So the claim a mocked run makes is deliberately narrower — the builder mounts, renders a space and reacts to
 *  being used. Anything whose subject is the server itself is marked `onlyLiveBackend()` and skips.
 *
 *  The shapes come from a recording of the real boot: three operations, no more. Their `__typename`s are part of
 *  the contract — Apollo's cache normalises on them, and a response missing one is a response the client quietly
 *  refuses to store. */

type GraphQLBody = { operationName?: string; variables?: Record<string, unknown> };

/** What the mocked backend serves. A whole page from element types the SDK ships — a space needing plugin
 *  components would render "Component … Not Found" here, since a mock has no deployment behind it to provide
 *  them. A spec that needs a different one says so: `test.use({ mockSpace: minimalSpace() })`. */
export const defaultMockSpace = (): OfflineDataRaw => plainSpace();

/** Everything the builder needs to draw a space: what it is called, its elements, its stylesheet. */
/** Apollo normalises what it stores, and it reports every field the query asked for but the response did not
 *  carry — as a console error, which the suite's guard then fails on. So the mock has to answer with the SHAPE
 *  the schema declares, not merely with data that happens to render: `idRef` and the `__typename`s included. */
const asList = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value as Record<string, unknown>[];
  }

  return value && typeof value === 'object' ? Object.values(value as Record<string, Record<string, unknown>>) : [];
};

const asElement = (id: string, node: Record<string, unknown>) => {
  const definition = (node.definition ?? {}) as Record<string, unknown>;

  return {
    id,
    idRef: (node.idRef as string | null) ?? null,
    attributes: node.attributes ?? {},
    definition: {
      label: definition.label ?? '',
      type: definition.type ?? 'container',
      initialState: definition.initialState ?? null,
      styleSelectors: definition.styleSelectors ?? { base: '' },
      bindings: definition.bindings ?? null,
      interactions: definition.interactions ?? null,
      parentId: definition.parentId ?? null,
      rootId: definition.rootId ?? null,
      items: definition.items ?? [],
      __typename: 'SpaceElementDefinition'
    },
    __typename: 'SpaceElement'
  };
};

const initQuery = (space: OfflineDataRaw) => {
  const { schema } = space;
  /** Read as partial on purpose: the type says a space always carries a whole stylesheet, and a space built by
   *  hand for one spec carries the one rule it is about. The mock has to answer for both. */
  const style: Partial<Style> = space.style;
  /** A LIST over the wire, keyed only once it reaches the client. The offline shape is a map, so this is where
   *  the two representations of the same space meet — and returning the map is a response Apollo reads as one
   *  element missing every field it asked for. */
  const flat = Object.entries(schema.flat).map(([id, node]) =>
    asElement(id, node as unknown as Record<string, unknown>)
  );

  return {
    data: {
      Space: {
        definition: { name: 'E2E Space', permanentUrl: 'e2e-space', __typename: 'SpaceDefinition' },
        schema: {
          settings: schema.settings,
          flat,
          pages: schema.pages,
          // Lists over the wire, both of them. A space that declares neither still has to answer with an empty
          // one: an empty OBJECT is read as a single record missing every field the query selected.
          pageFolders: asList(schema.pageFolders).map(folder => ({ ...folder, __typename: 'SpacePageFolder' })),
          variables: asList(schema.variables),
          __typename: 'SpaceSchema'
        },
        segments: [],
        // No remote plugins: every element in the sample space is one the SDK ships, and a resource fetched from
        // a CDN is the one thing a run without network cannot have.
        plugins: [],
        /** Every field the query selects, present even when the space left it out — a space small enough to be
         *  readable in a spec defines a stylesheet and nothing else. */
        style: {
          id: 'e2e-style',
          platform: style.platform ?? {},
          variables: style.variables ?? {},
          mode: style.mode ?? 'desktop-first',
          cache: style.cache ?? '',
          __typename: 'Style'
        },
        __typename: 'Space'
      }
    }
  };
};

const emptyConnection = (typename: string) => ({
  edges: [],
  pageInfo: { hasPrevPage: false, hasNextPage: false, from: 0, to: 0, total: 0, __typename: 'PageInfo' },
  __typename: typename
});

const handlers: Record<string, ((space: OfflineDataRaw) => unknown) | undefined> = {
  InitQuery: initQuery,
  SpaceConnectorsQuery: () => ({ data: { SpaceConnectors: emptyConnection('SpaceConnectorListType') } }),
  /** A space with no server actions still has to ANSWER: the builder reads `.edges` off whatever comes back, and
   *  the fallback acknowledgement gives it `true`. That crashed the panel's provider on boot — which took the
   *  whole app down, since it mounts above the canvas. */
  SpaceActionsQuery: () => ({ data: { SpaceActions: emptyConnection('SpaceActionListType') } }),
  /** Same rule as the actions above, and the panel reads this one at boot too: a space with no credentials still
   *  has to answer with a connection, because `true` is not something `.edges` can be read off. */
  SpaceCredentialsQuery: () => ({ data: { SpaceCredentials: emptyConnection('SpaceCredentialListType') } }),
  /** The step catalog, which is SERVED rather than compiled in — so a mocked backend serves an empty one. A
   *  builder with no tasks offers no server steps, which is exactly right for a run with no server behind it. */
  SpaceActionTasksQuery: () => ({ data: { SpaceActionTasks: [] } }),
  SpaceDeploymentsQuery: () => ({
    data: {
      SpaceDeployments: {
        edges: [
          {
            id: '1',
            environment: 'main',
            revision: null,
            domain: 'e2e.plitzi.app',
            isVerified: true,
            default: true,
            credential: null,
            createdAt: 0,
            updatedAt: 0,
            __typename: 'SpaceDeployment'
          }
        ],
        pageInfo: { hasPrevPage: false, hasNextPage: false, from: 0, to: 1, total: 1, __typename: 'PageInfo' },
        __typename: 'SpaceDeploymentListType'
      }
    }
  })
};

/** Writes are accepted and discarded. The builder only needs to know its mutation succeeded to move on; what the
 *  spec then asserts is the state the app itself holds, which is where an unsaved edit lives anyway. */
const acknowledge = (operationName: string) => ({ data: { [operationName.replace(/Mutation$/, '')]: true } });

export const answerGraphQL = (raw: string | null, space: OfflineDataRaw): unknown => {
  if (!raw) {
    return { data: {} };
  }

  const body = JSON.parse(raw) as GraphQLBody | GraphQLBody[];
  const operations = Array.isArray(body) ? body : [body];

  const answers = operations.map(operation => {
    const name = operation.operationName ?? '';
    const handler = handlers[name];

    return handler ? handler(space) : acknowledge(name);
  });

  return Array.isArray(body) ? answers : answers[0];
};

/** Operation names this mock answers with real data rather than an acknowledgement. Exported so a spec can assert
 *  it is not silently relying on the fallback. */
export const mockedOperations = Object.keys(handlers);
