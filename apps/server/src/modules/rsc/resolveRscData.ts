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
  /**
   * Aborted when this element's budget runs out, so a resolver can stop the work nobody is waiting for.
   *
   * The timeout below only ever decided when to STOP WAITING — the losing side of a race keeps running — so a
   * provider that took longer than its budget went on holding a run slot and an outbound connection for a page
   * that had already been sent. What is being cancelled is not the request, it is the work behind it.
   */
  signal: AbortSignal;
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
  /**
   * Per-element budget: one slow provider must not hold the whole payload, and must not go on working once it
   * has. It is the PAGE's ceiling and it wins over the producer's own — an action allowed ten seconds of its own
   * is still cut off here, because a section is worth waiting for only as long as the visitor is. Configurable
   * per deployment as `rsc.elementTimeoutMs`.
   */
  timeoutMs?: number;
};

const DEFAULT_ELEMENT_TIMEOUT_MS = 5000;

/**
 * Runs one element's resolution against its budget, and CANCELS it when the budget is gone.
 *
 * The race decides what the payload waits for; the abort decides what the server keeps doing. Racing alone left
 * the loser running to its own timeout — for actions, five more seconds of a held slot and an in-flight request
 * per element, for a page that was answered without it.
 */
const withBudget = async <T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      run(controller.signal),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error(`RSC resolution timed out after ${timeoutMs}ms for ${label}`));
        }, timeoutMs);
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
      data: await withBudget(
        signal =>
          resolveElement({
            element,
            flat: schema.flat,
            routeParams,
            queryParams: req.query,
            req,
            spaceId,
            environment,
            user,
            signal
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
