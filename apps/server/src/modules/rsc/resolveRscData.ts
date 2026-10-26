import { getSourceName } from '@plitzi/sdk-shared/dataSource/helpers';
import { flagUserFromSSR, flagValues, resolveFlags } from '@plitzi/sdk-shared/flags';
import { evaluateRuleGroup } from '@plitzi/sdk-shared/helpers';
import {
  collectServerElements,
  inputProviders,
  pageAccessOf,
  pageAccessRefusal,
  RSC_FAILURE,
  serverInputOf,
  serverProviderSource,
  serverWhenValues,
  whenOf,
  whenProviders,
  whenUnknownToServer,
  withholdPages
} from '@plitzi/sdk-shared/schema';

import { matchRscPage } from './matchRscPage';
import { onAbort } from '../../helpers/onAbort';
import { serverLog } from '../../helpers/serverLog';

import type { Element, Environment, Schema, SSRRequest, SSRRscData, SSRUser } from '@plitzi/sdk-shared';
import type { FlagOverrides } from '@plitzi/sdk-shared/flags';

/** Everything an element resolver needs to turn one `runtime: 'server'` element into its data slice. */
export type RscResolveContext = {
  element: Element;
  /**
   * What its input resolves to on the page server: what it was saved with, and its bound input the server reads — the
   * address, the answers of the server providers before it (`serverInputOf`).
   */
  input?: unknown;
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
  /** The layers above the space that decide its flags for this request — see `SSRRscContext.flagOverrides`. */
  flagOverrides?: FlagOverrides;
  /**
   * Per-element budget: one slow provider must not hold the whole payload, and must not go on working once it
   * has. It is the PAGE's ceiling and it wins over the producer's own — an action allowed ten seconds of its own
   * is still cut off here, because a section is worth waiting for only as long as the visitor is. Configurable
   * per deployment as `rsc.elementTimeoutMs`.
   */
  timeoutMs?: number;
  /** Whoever asked stopped waiting: every element still resolving is cancelled, as when its budget runs out. */
  signal?: AbortSignal;
  /** While developing: a failed element says why in its data (`RSC_FAILURE`), where its provider shows it. */
  sayFailures?: boolean;
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
  label: string,
  asked?: AbortSignal
): Promise<T> => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const releaseAsked = asked ? onAbort(asked, () => controller.abort()) : undefined;
  try {
    return await Promise.race([
      run(controller.signal),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          // Says the knob: a cold start reading many sources is the usual reason, and the element arrives empty.
          reject(
            new Error(
              `RSC resolution timed out after ${timeoutMs}ms for ${label} — its section arrives empty. ` +
                'A slower producer is given more with `createServer({ rsc: { elementTimeoutMs } })`.'
            )
          );
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }

    releaseAsked?.();
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
  flagOverrides,
  timeoutMs = DEFAULT_ELEMENT_TIMEOUT_MS,
  signal,
  sayFailures = false
}: ResolveRscDataOptions): Promise<SSRRscData> => {
  if (schema.rsc?.enabled === false) {
    return {};
  }

  const match = matchRscPage(schema, req.path, user);
  if (!match) {
    return { serverData: {} };
  }

  const { pageId, routeParams } = match;
  // The data of a page this visitor may not see is theirs no more than its content is — but the layout around its
  // refusal is the site's, drawn for them as on every page: its providers are read (a run's withheld page drew its
  // header with a blank avatar and no inbox, every layout source "could not be reached").
  const withheld = pageAccessRefusal(pageAccessOf(schema.flat[pageId].attributes), user) !== undefined;
  // As the browser is sent it: the withheld page's own elements out, and the page the space draws in its place in.
  const drawn = withheld ? withholdPages(schema, user).schema : schema;

  // Against the page just matched, as the browser resolves them for it: an element a flag switched off is not drawn,
  // and its data must not travel in the payload regardless.
  const flags = flagValues(
    resolveFlags(
      schema.flags,
      { environment, hostname: req.hostname, routeParams, queryParams: req.query, user: flagUserFromSSR(user) },
      flagOverrides
    )
  );
  // Every server element of the page, though only some are asked: a `when` reads the answer of another, asked or not.
  const all = collectServerElements(drawn, pageId, undefined, flags);
  const asked = ids ? new Set(ids) : undefined;
  const targets = asked ? all.filter(element => asked.has(element.id)) : all;
  if (targets.length === 0) {
    return { serverData: {} };
  }

  const byId = new Map(all.map(element => [element.id, element] as const));
  const serverIds = new Set(byId.keys());
  const resolving = new Map<string, Promise<unknown>>();
  const resolveOne = (element: Element, chain: readonly string[]): Promise<unknown> => {
    const started = resolving.get(element.id);
    if (started) {
      return started;
    }

    const run = async (): Promise<unknown> => {
      // The answers of the server providers it reads, each resolved first — the one it is waiting in the chain of
      // left out: two that read each other are read in the order they come, the later seeing nothing of the other.
      const answersOf = async (ids: readonly string[], what: string) =>
        Object.fromEntries(
          await Promise.all(
            ids
              .filter(id => id !== element.id && !chain.includes(id))
              .map(async id => {
                const other = byId.get(id);
                const answer = other
                  ? await resolveOne(other, [...chain, element.id]).catch((reason: unknown) => {
                      // An asked one's failure is said with the rest; one read only for this element, here.
                      if (asked && !asked.has(id)) {
                        serverLog.warn(
                          'RSC',
                          `element ${element.id}'s ${what} reads ${id}, which failed to resolve`,
                          reason
                        );
                      }

                      return undefined;
                    })
                  : undefined;

                return [id, { answer, singleRecord: other?.attributes.singleRecord === true }] as const;
              })
          )
        );

      // A `when` read in the browser alone — a state, a variable — is not the page server's to decide: resolved, as
      // authoring warns (`server-when-unknown`). One it knows all of waits for the providers it reads, in turn.
      const gate = whenOf(element);
      if (gate && whenUnknownToServer(gate, schema.flat, serverIds).length === 0) {
        const values = serverWhenValues({
          routeParams,
          queryParams: req.query,
          pageId,
          user,
          answers: await answersOf(whenProviders(gate, serverIds), '`when`')
        });
        if (!evaluateRuleGroup(gate, values)) {
          return undefined;
        }
      }

      // Its bound input, as the browser resolves it: the address, and the answers of the server providers it reads.
      const reads = await answersOf(inputProviders(element, serverIds), 'input');
      const input = serverInputOf(
        element,
        { routeParams, queryParams: req.query },
        Object.fromEntries(
          Object.entries(reads).map(([id, { answer, singleRecord }]) => [
            getSourceName('apiContainer', id),
            serverProviderSource(answer, singleRecord)
          ])
        )
      );

      return withBudget(
        elementSignal =>
          resolveElement({
            element,
            input,
            flat: schema.flat,
            routeParams,
            queryParams: req.query,
            req,
            spaceId,
            environment,
            user,
            signal: elementSignal
          }),
        timeoutMs,
        `element ${element.id}`,
        signal
      );
    };
    const promise = run();
    resolving.set(element.id, promise);

    return promise;
  };

  const settled = await Promise.allSettled(
    targets.map(async element => ({ id: element.id, data: await resolveOne(element, []) }))
  );

  const serverData = settled.reduce<Record<string, unknown>>((acum, result, index) => {
    if (result.status === 'rejected') {
      // Nobody is waiting for it any more: not a failure of the element.
      if (!signal?.aborted) {
        const reason: unknown = result.reason;
        // An action that refused this visitor did its job: one line of why, no stack; anything else is an error.
        if (reason instanceof Error && 'refused' in reason && reason.refused === true) {
          serverLog.warn('RSC', `element ${targets[index].id}: ${reason.message}`);
        } else {
          serverLog.error('RSC', `element ${targets[index].id} failed to resolve`, reason);
        }

        // A refusal's words are the visitor's, as `/_action` answers them: said where the page reads them, everywhere.
        // Anything else only while developing — the provider shows why, not "could not be reached".
        const said =
          reason instanceof Error && 'said' in reason && typeof reason.said === 'string' ? reason.said : undefined;
        if (said !== undefined) {
          acum[targets[index].id] = { [RSC_FAILURE]: said };
        } else if (sayFailures) {
          acum[targets[index].id] = { [RSC_FAILURE]: reason instanceof Error ? reason.message : String(reason) };
        }
      }

      return acum;
    }

    if (result.value.data !== undefined) {
      acum[result.value.id] = result.value.data;
    }

    return acum;
  }, {});

  return { serverData };
};
