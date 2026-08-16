import { collectServerElements } from '@plitzi/sdk-shared/schema/serverElements';

import { matchRscPage } from './matchRscPage';

import type { Element, Environment, Schema, SSRRequest, SSRRscData, SSRUser } from '@plitzi/sdk-shared';

/** Everything an element resolver needs to turn one `runtime: 'server'` element into its data slice. */
export type RscResolveContext = {
  element: Element;
  /** The whole element map, so a resolver can inspect the subtree that consumes its data. */
  flat: Record<string, Element>;
  routeParams: Record<string, string | undefined>;
  queryParams: Record<string, string>;
  req: SSRRequest;
  spaceId: number;
  environment: Environment;
  user: SSRUser | undefined;
};

/** Produces the data slice for a single server element. Returning undefined leaves the element out of the payload. */
export type RscElementResolver = (context: RscResolveContext) => Promise<unknown>;

export type ResolveRscDataOptions = {
  schema: Schema;
  req: SSRRequest;
  spaceId: number;
  environment: Environment;
  user: SSRUser | undefined;
  /** Restricts resolution to these element ids (partial refresh). Undefined resolves every server element. */
  ids?: string[];
  resolveElement: RscElementResolver;
  /** Per-element budget. One slow provider must not hold the whole payload. */
  timeoutMs?: number;
};

const DEFAULT_ELEMENT_TIMEOUT_MS = 5000;

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`RSC resolution timed out after ${timeoutMs}ms for ${label}`)),
          timeoutMs
        );
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

/**
 * Resolves the server-side data slices for the page addressed by `req`.
 *
 * The URL is matched against the schema's pages with the same matcher the client router uses, so the element set
 * and the route params are what the browser will see. Each `runtime: 'server'` element resolves independently:
 * a provider that fails or hangs costs its own slice and nothing else.
 */
export const resolveRscData = async ({
  schema,
  req,
  spaceId,
  environment,
  user,
  ids,
  resolveElement,
  timeoutMs = DEFAULT_ELEMENT_TIMEOUT_MS
}: ResolveRscDataOptions): Promise<SSRRscData> => {
  if (schema.rsc?.enabled === false) {
    return {};
  }

  const match = matchRscPage(schema, req.path, user);
  if (!match) {
    return { serverData: {} };
  }

  const { pageId, routeParams } = match;
  const targets = collectServerElements(schema, pageId, ids);
  if (targets.length === 0) {
    return { serverData: {} };
  }

  const settled = await Promise.allSettled(
    targets.map(async element => ({
      id: element.id,
      data: await withTimeout(
        resolveElement({
          element,
          flat: schema.flat,
          routeParams,
          queryParams: req.query,
          req,
          spaceId,
          environment,
          user
        }),
        timeoutMs,
        `element ${element.id}`
      )
    }))
  );

  const serverData = settled.reduce<Record<string, unknown>>((acum, result, index) => {
    if (result.status === 'rejected') {
      console.error(`[RSC] element ${targets[index].id} failed to resolve:`, result.reason);

      return acum;
    }

    if (result.value.data !== undefined) {
      acum[result.value.id] = result.value.data;
    }

    return acum;
  }, {});

  return { serverData };
};
