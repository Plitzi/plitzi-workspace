import { evaluateRuleGroup } from '@plitzi/sdk-shared/helpers/ruleEvaluator';
import { hasValidToken, processTwig } from '@plitzi/sdk-shared/helpers/twigWrapper';

import { ActionRunError } from './errors';
import { runCancelKey } from './guards';
import { createKvStore } from './kvStore';
import { resolveLimits } from './limits';
import { createMemoryKv } from './memoryKv';
import { namespaceKv } from './namespaceKv';
import { precheckRun } from './precheck';
import { createRedactor, projectUser } from './scope';
import { onAbort } from '../../../helpers/onAbort';

import type {
  ActionKvAdapter,
  ActionRunRecord,
  ActionRunRequest,
  ActionRunResult,
  ActionsConfig,
  ActionTaskContext,
  ActionTaskRegistry,
  RegisteredTask,
  ResolvedActionLimits
} from '../types';
import type { ElementInteraction, InteractionNode, InteractionNodeStatus } from '@plitzi/sdk-shared';
import type { RuleValue } from '@plitzi/sdk-shared/helpers/ruleEvaluator';

const MAX_TWIG_RESOLUTION_PASSES = 5;

/** How often a run asks the shared store whether it has been cancelled. Once a second is far finer than the
 *  boundaries a flow actually has, and it keeps a long run to sixty reads a minute. */
const CANCEL_POLL_MS = 1_000;

/**
 * Whether somebody has asked this run to stop, from wherever the request landed.
 *
 * The socket closing aborts a run in the process that is running it, and a `DELETE` that happens to reach that
 * same process does too. Behind a load balancer it usually does not: a cancel arrives at a replica that has never
 * heard of the run, and the flow it was meant to stop carries on charging cards. So the cancel is a FLAG in the
 * store the deployment already shares, and this is the run reading it at every step boundary.
 *
 * Without a shared store it is a no-op rather than a lie — one process's local abort is the whole mechanism there,
 * and it already works.
 */
const createCancelWatch = (store: ActionKvAdapter | undefined, runId: string): (() => Promise<boolean>) => {
  if (!store) {
    return () => Promise.resolve(false);
  }

  let checkedAt = 0;

  return async () => {
    const now = Date.now();
    if (now - checkedAt < CANCEL_POLL_MS) {
      return false;
    }

    checkedAt = now;
    try {
      return (await store.get(runCancelKey(runId))) !== undefined;
    } catch {
      // A store that cannot answer is not a cancellation. Failing the run over it would turn an outage in the
      // cache into an outage in everybody's flows.
      return false;
    }
  };
};

/**
 * Resolves twig in a node's params against the flow scope.
 *
 * Multi-pass with a ceiling, exactly as the client engine does: a value can resolve to another template, and
 * without the ceiling a self-referencing pair spins forever. Unresolved tokens are left as-is and show up in the
 * trace, which is how an author sees that a step referenced something the flow never produced.
 */
const resolveParams = (
  params: Record<string, unknown>,
  scope: Record<string, unknown>,
  raw: boolean
): Record<string, unknown> => {
  if (raw) {
    return params;
  }

  return Object.entries(params).reduce<Record<string, unknown>>((acum, [key, param]) => {
    let value = param;
    let passes = MAX_TWIG_RESOLUTION_PASSES;
    while (typeof value === 'string' && hasValidToken(value) && passes > 0) {
      value = processTwig(value, scope, false, true);
      passes--;
    }

    acum[key] = value;

    return acum;
  }, {});
};

/**
 * Holds an answer to what the run is allowed to carry.
 *
 * Two checks rather than one, because a body arrives in two ways. `Content-Length` is refused before a byte is
 * read, which is the cheap half; a chunked answer that declares nothing is counted AS it streams and errored the
 * moment it goes over — so the ceiling holds for a backend that lies about its size or never states one.
 *
 * The cap is on one response and not on the run: it exists so that a single answer cannot be unbounded, which is
 * a different failure from a flow that makes many small calls (that is `maxRequests`).
 */
const capped = (response: Response, maxBytes: number): Response => {
  const declared = Number(response.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ActionRunError('over_capacity', `Response is larger than the ${maxBytes} byte budget`);
  }

  if (!response.body) {
    return response;
  }

  let seen = 0;
  const counted = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform: (chunk, controller) => {
        seen += chunk.byteLength;
        if (seen > maxBytes) {
          controller.error(new ActionRunError('over_capacity', `Response exceeded the ${maxBytes} byte budget`));

          return;
        }

        controller.enqueue(chunk);
      }
    })
  );

  return new Response(counted, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
};

/**
 * Counts outbound calls, refuses past the budget, caps what one answer may carry back, and stamps the run's
 * lineage on every one of them.
 *
 * The budget stops a loop from turning one run into a hundred requests. The lineage header is what makes the
 * OTHER loop detectable: an action whose HTTP step reaches its own space's webhook arrives carrying the chain
 * that led there, and the run it would start refuses itself. It names the space's own actions to a backend that
 * space configured, which is the cost of catching a cycle nothing else can see.
 *
 * Every ceiling lives HERE rather than in each task, because this is the only door a task has to the outside
 * world — a task that had to remember to count its own bytes is a task that will forget.
 */
const createRunFetch = (
  base: typeof fetch,
  signal: AbortSignal,
  limits: ResolvedActionLimits,
  lineage: string[]
): typeof fetch => {
  let issued = 0;

  return async (input, init) => {
    issued += 1;
    if (issued > limits.maxRequests) {
      throw new ActionRunError('over_capacity', `Action exceeded its ${limits.maxRequests} outbound request budget`);
    }

    const headers = new Headers(init?.headers);
    headers.set('X-Plitzi-Action-Lineage', lineage.join(','));

    return capped(await base(input, { ...init, headers, signal: init?.signal ?? signal }), limits.maxResponseBytes);
  };
};

/**
 * Fills in what the node left out, from the task's own catalog entry.
 *
 * A task declares its params with a `defaultValue`, and a document written before a param existed simply has no
 * value for it. Without this the task receives `undefined` for something its signature says is a string, which is
 * how tasks end up full of defensive conversions that hide the real gap.
 */
const withDefaults = (task: RegisteredTask, params: Record<string, unknown>): Record<string, unknown> =>
  Object.entries(task.params).reduce<Record<string, unknown>>(
    (acum, [key, param]) => {
      if (acum[key] === undefined || acum[key] === '') {
        acum[key] = param.defaultValue ?? '';
      }

      return acum;
    },
    { ...params }
  );

type NodeOutcome = { status: InteractionNodeStatus; result: unknown };

const runNode = async (
  node: ElementInteraction,
  scope: Record<string, unknown>,
  registry: ActionTaskRegistry,
  buildContext: (scope: Record<string, unknown>) => ActionTaskContext
): Promise<NodeOutcome> => {
  if (!node.action || !node.enabled) {
    return { status: 'disabled', result: {} };
  }

  if (node.when && !evaluateRuleGroup(node.when, { ...scope, [node.id]: node.params } as Record<string, RuleValue>)) {
    return { status: 'skipped', result: {} };
  }

  if (node.type !== 'task') {
    throw new ActionRunError('failed', `Step "${node.action}" is a ${node.type}, which cannot run on the server`);
  }

  const task = registry.get(node.action);
  if (!task) {
    throw new ActionRunError('failed', `No server task is registered as "${node.action}"`);
  }

  const params = withDefaults(task, resolveParams(node.params, scope, task.rawParams === true));
  const result = await task.run(params, buildContext(scope));

  return { status: 'success', result };
};

export type ActionRunner = { runAction: (request: ActionRunRequest) => Promise<ActionRunResult> };

/**
 * Builds the runner every trigger goes through.
 *
 * Every check that decides whether a run may happen at all — the trigger and whether it is on, access, lineage,
 * input contract — lives HERE rather than in a transport, because a deployment mounting its own trigger calls this
 * directly. A check in the endpoint would be a check a custom trigger silently skips.
 */
export const createActionRunner = (
  config: ActionsConfig,
  registry: ActionTaskRegistry,
  baseFetch: typeof fetch = fetch
): ActionRunner => {
  const kv = createKvStore(config.kv ?? createMemoryKv());

  /** Never allowed to fail a run: a logging outage must not take an action down, the same rule metering follows. */
  const record = async (entry: ActionRunRecord) => {
    try {
      await config.onRun?.(entry);
    } catch (error) {
      console.error('[Actions] run record failed:', error);
    }
  };
  const runAction = async (request: ActionRunRequest): Promise<ActionRunResult> => {
    const { entry, runId } = request;
    const { document } = entry;

    // The endpoint already ran this; a custom trigger may not have. It is pure and cheap, and being the only
    // implementation is what keeps the two paths from drifting into different rules. It also answers WHICH step
    // starts the run — the trigger for the kind that fired, not whichever one comes first in the map.
    const { trigger: triggerNode, values } = precheckRun(entry, {
      trigger: request.trigger,
      input: request.input,
      user: request.user,
      lineage: request.lineage
    });

    const limits: ResolvedActionLimits = resolveLimits(config.limits, document.limits);
    // Learns as the run goes: a credential is registered by the task that resolved it, always before that task's
    // own result is redacted. Nothing is resolved up front because nothing is declared up front any more.
    const redactor = createRedactor();
    const redact = redactor.redact;

    const controller = new AbortController();
    const timeoutMs = request.emit ? limits.streamTimeoutMs : limits.timeoutMs;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const releaseOuter = onAbort(request.signal, () => controller.abort());

    const scopedKv = namespaceKv(kv, request.spaceId);
    const runFetch = createRunFetch(baseFetch, controller.signal, limits, [...(request.lineage ?? []), entry.id]);
    const buildContext = (scope: Record<string, unknown>): ActionTaskContext => ({
      runId,
      spaceId: request.spaceId,
      environment: request.environment,
      trigger: request.trigger,
      user: request.user,
      signal: controller.signal,
      scope,
      /**
       * The secret a STEP asked for, resolved inside that step and never in the flow scope.
       *
       * There is no allow-list to check it against, deliberately: an action is authored by someone who may edit
       * every action in the space, so a list they can edit is not a boundary — it only ever told the redactor what
       * to look for, and the redactor now learns from what was actually resolved. What IS a boundary is that a
       * credential reaches only the params of the step that named it, which is `renderTaskParams`' whole job.
       */
      credential: async identifier => {
        const credential = await config.lookups.getCredential?.(request.spaceId, identifier);
        if (credential) {
          redactor.add(credential);
        }

        return credential;
      },
      connector: async connectorId => {
        const manifest = await config.lookups.getConnector?.(request.spaceId, connectorId, request.at);
        if (!manifest) {
          return undefined;
        }

        // The connector's own credential: naming the connector is what reaches the secret it declares, exactly as
        // the element-addressed write endpoint has always done.
        const credential = manifest.credential
          ? await config.lookups.getCredential?.(request.spaceId, manifest.credential)
          : undefined;
        if (credential) {
          redactor.add(credential);
        }

        return { manifest, credential };
      },
      fetch: runFetch,
      kv: scopedKv,
      dbDrivers: config.dbDrivers ?? [],
      emit: chunk => request.emit?.(redact(chunk))
    });

    const trace: InteractionNode[] = [];
    const startedAt = Date.now();
    let failure: string | undefined;
    /**
     * What every step can see.
     *
     * The run itself carries only the basics — which space, which environment, who asked, what came in — and
     * everything else a flow can reach is whatever a TASK chose to return into it. Credentials are deliberately
     * NOT here: an ambient `{{credential.*}}` would be interpolable by any node, including `flow.output`, which
     * is a secret handed to the browser through a step nobody would think to audit. A task that needs one asks
     * for it by identifier and resolves it inside its own execution.
     */
    const scope: Record<string, unknown> = {
      input: values,
      user: projectUser(request.user),
      spaceId: request.spaceId,
      environment: request.environment,
      trigger: request.trigger,
      runId
    };

    let status: ActionRunResult['status'] = 'completed';
    let returned: unknown;

    const isCancelled = createCancelWatch(config.kv, runId);

    try {
      let current = triggerNode;
      let executed = 0;
      let next = document.nodes[current.afterNode] as ElementInteraction | undefined;
      while (next) {
        if (controller.signal.aborted) {
          status = 'aborted';
          break;
        }

        // Between steps, never inside one: a node already in flight is signalled and awaited rather than
        // abandoned mid-write, so an aborted run is one that stopped starting things — not one that left half a
        // request behind it.
        if (await isCancelled()) {
          controller.abort();
          status = 'aborted';
          break;
        }

        executed += 1;
        if (executed > limits.maxNodes) {
          throw new ActionRunError('over_capacity', `Action exceeded its ${limits.maxNodes} step budget`);
        }

        const startTime = Date.now();
        const outcome = await runNode(next, scope, registry, buildContext);
        trace.push({
          node: next,
          status: outcome.status,
          result: redact(outcome.result),
          postCallbacks: [],
          startTime,
          endTime: Date.now()
        });

        request.onNode?.(next.id, outcome.status);
        scope[next.id] = outcome.result;
        if (next.action === 'flow.output' && outcome.status === 'success') {
          returned = outcome.result;
        }

        current = next;
        next = document.nodes[current.afterNode];
      }
    } catch (error) {
      // A failed step ENDS the run. The client engine carries on past one because a broken button leaves a page
      // usable; a server flow that keeps going after a failed authorization or a failed charge does damage.
      status = controller.signal.aborted ? 'aborted' : 'failed';
      if (error instanceof ActionRunError) {
        throw error;
      }

      failure = error instanceof Error ? error.message : String(error);
      trace.push({
        node: { id: 'error', title: 'Error', action: 'error' } as ElementInteraction,
        status: 'failed',
        result: redact({ error: error instanceof Error ? error.message : String(error) }),
        postCallbacks: [],
        startTime: Date.now(),
        endTime: Date.now()
      });
    } finally {
      clearTimeout(timer);
      releaseOuter();
    }

    // What the `flow.output` step named, and nothing else. No second contract to disagree with it: a key that step
    // did not name never existed as far as the caller is concerned.
    const output = (returned ?? {}) as Record<string, unknown>;

    // Recorded here rather than at each transport, so a run started by a webhook, a schedule or a deployment's own
    // trigger leaves the same trace as one started by a page.
    await record({
      runId,
      actionId: entry.id,
      spaceId: request.spaceId,
      environment: request.environment,
      trigger: request.trigger,
      status,
      durationMs: Date.now() - startedAt,
      ...(request.user ? { userId: request.user.id } : {}),
      nodes: trace.map(step => ({ id: step.node.id, action: step.node.action, status: step.status })),
      ...(failure === undefined ? {} : { error: redact(failure) })
    });

    return { runId, status, output: redact(output), trace };
  };

  return { runAction };
};
