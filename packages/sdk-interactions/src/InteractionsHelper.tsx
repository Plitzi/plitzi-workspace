import { get, omit } from '@plitzi/plitzi-ui/helpers';
import { QueryBuilderEvaluator } from '@plitzi/plitzi-ui/QueryBuilder';

import { pConsole } from '@plitzi/sdk-shared/devTools/utils/PlitziConsole';
import { processTwig, hasValidToken } from '@plitzi/sdk-shared/helpers/twigWrapper';

import utility from './utility';

import type { RuleValue } from '@plitzi/plitzi-ui/QueryBuilder';
import type {
  ElementInteraction,
  InteractionCallback,
  InteractionCallbackContext,
  InteractionNode,
  InteractionNodeStatus,
  InteractionStatus,
  PostCallbackNode
} from '@plitzi/sdk-shared';

const MAX_TWIG_RESOLUTION_PASSES = 5;

/**
 * How deep into a param's own structure the resolver will go.
 *
 * A guard rather than a limit anybody should meet: it stops a value that somehow refers to itself from turning a
 * step into an infinite walk, and five levels is deeper than any authored param has ever been.
 */
const MAX_PARAM_DEPTH = 5;

const processParams = (
  type: InteractionCallback['type'],
  params: Record<string, unknown>,
  flowValues: Record<string, unknown>,
  globalValues: Record<string, unknown>,
  action: string
): Record<string, unknown> => {
  if (type === 'utility' && action === 'twigTemplate') {
    return params;
  }

  const scope = { ...flowValues, ...globalValues };

  /**
   * Resolve every STRING in the param, wherever it happens to sit.
   *
   * A param is not always a string. `input` on a server action is the case that matters: authored as one line of
   * JSON text it resolves fine until a value contains a quotation mark or a newline — a post body, in other words
   * — and then the interpolated result is not a document any more and the whole call is refused as invalid input.
   * Written as an OBJECT instead, each value is its own string and nothing has to be escaped by hand; that only
   * works if the resolver goes in after them, which is what this does.
   */
  const resolve = (value: unknown, param: string, depth: number): unknown => {
    if (typeof value === 'string') {
      let resolved: unknown = value;
      let passes = MAX_TWIG_RESOLUTION_PASSES;
      while (typeof resolved === 'string' && hasValidToken(resolved) && passes > 0) {
        resolved = processTwig(resolved, scope, false, true);
        passes--;
      }

      if (typeof resolved === 'string' && hasValidToken(resolved)) {
        pConsole.warning(
          'interactions',
          <span>
            Twig token resolution exceeded {MAX_TWIG_RESOLUTION_PASSES} passes for <b>{param}</b>, leaving unresolved
            tokens
          </span>,
          { param, value: resolved }
        );
      }

      return resolved;
    }

    if (depth >= MAX_PARAM_DEPTH || value === null || typeof value !== 'object') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(entry => resolve(entry, param, depth + 1));
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, resolve(entry, param, depth + 1)])
    );
  };

  return Object.keys(params).reduce((acum, param) => {
    const value = type === 'trigger' ? params[param] : resolve(params[param], param, 0);

    return { ...acum, [param]: value };
  }, {});
};

const processNode = async (
  node: ElementInteraction,
  callbacksAvailables: Record<string, InteractionCallback> = {},
  flowParams = {},
  globalParams = {},
  // The element this flow fired on. Threaded through so a step that starts something asynchronous — a detached
  // server action — can report back to it when it finishes, long after this flow returned.
  context: InteractionCallbackContext = {}
): Promise<{
  status: InteractionNodeStatus;
  result: unknown;
  postCallbacks: PostCallbackNode[];
  whenParams?: Record<string, RuleValue>;
}> => {
  let result: unknown = {};
  const postCallbacks: PostCallbackNode[] = [];
  const { id, action, enabled, params, elementId, type, when } = node;
  if (!action || !enabled) {
    return { status: 'disabled', result, postCallbacks };
  }

  const whenParams = { ...globalParams, ...flowParams, [id]: params };
  if (when && !QueryBuilderEvaluator(when, whenParams)) {
    return { status: 'skipped', result, postCallbacks, whenParams };
  }

  const paramsToCallback = {
    ...flowParams,
    ...globalParams,
    ...processParams(type, params, flowParams, globalParams, action)
  };
  try {
    switch (type) {
      case 'callback':
      case 'globalCallback': {
        if (!elementId) {
          pConsole.warning(
            'interactions',
            <span>
              Step <b>{action}</b> names no element, so there is nothing to run it on
            </span>,
            { node }
          );

          return { status: 'failed', result, postCallbacks, whenParams };
        }

        const receptorCallback = get(callbacksAvailables, `${elementId}.${action}`) as InteractionCallback | undefined;
        if (!receptorCallback) {
          // The step is wired to something that does not exist, and the only symptom is a control that appears to do
          // nothing at all — so say which name was looked for and what was actually registered there.
          pConsole.warning(
            'interactions',
            <span>
              Nothing is registered as <b>{`${elementId}.${action}`}</b>, so this step did nothing
            </span>,
            { node, available: Object.keys(get(callbacksAvailables, elementId, {})) }
          );

          return { status: 'failed', result, postCallbacks, whenParams };
        }

        const { callback, postCallback } = receptorCallback;
        if (callback) {
          result = await callback(paramsToCallback, context);
        }

        if (postCallback) {
          postCallbacks.push({ id, callback: postCallback, params: { ...paramsToCallback, [id]: result } });
        }

        break;
      }

      case 'utility': {
        const { callback, postCallback } = get(utility, action, {}) as InteractionCallback;
        if (callback) {
          result = await callback(paramsToCallback, context);
        }

        if (postCallback) {
          postCallbacks.push({ id, callback: postCallback, params: { ...paramsToCallback, [id]: result } });
        }

        break;
      }

      default:
    }
  } catch (e: unknown) {
    pConsole.danger(
      'interactions',
      <span>
        Interaction node failed <b>{action}</b>
      </span>,
      { error: e instanceof Error ? e.message : String(e), node }
    );

    return { status: 'failed', result, postCallbacks, whenParams };
  }

  return { status: 'success', result, postCallbacks, whenParams };
};

const processPostCallbacks = async (postCallbacks: PostCallbackNode[] = []) => {
  const results: Record<string, unknown> = {};
  await Promise.all(
    postCallbacks.reverse().map(async ({ id, callback, params }) => {
      results[id] = await callback?.(omit(params, [id]), params[id]);
    })
  );

  return results;
};

const flowCallbacks = async (
  parentNode: ElementInteraction | undefined,
  nodes: Record<string, ElementInteraction> = {},
  callbacksAvailables = {},
  flowParams = {},
  globalParams = {},
  postCallbacksTotal: PostCallbackNode[] = [],
  executionResults: Record<string, InteractionNode> = {},
  context: InteractionCallbackContext = {}
) => {
  if (!parentNode) {
    return executionResults;
  }

  const node = get(nodes, parentNode.afterNode) as ElementInteraction | undefined;
  if (!node && postCallbacksTotal.length > 0) {
    await processPostCallbacks(postCallbacksTotal);
  }

  if (!node) {
    return executionResults;
  }

  const startTime = pConsole.getTime().valueOf();
  const { status, result, postCallbacks, whenParams } = await processNode(
    node,
    callbacksAvailables,
    flowParams,
    globalParams,
    context
  );
  executionResults[node.id] = {
    node,
    status,
    result,
    postCallbacks,
    whenParams,
    startTime,
    endTime: pConsole.getTime().valueOf()
  };
  postCallbacksTotal.push(...postCallbacks);

  return flowCallbacks(
    node,
    nodes,
    callbacksAvailables,
    { ...flowParams, [node.id]: result },
    globalParams,
    postCallbacksTotal,
    executionResults,
    context
  );
};

const storeLog = (
  triggerNode: ElementInteraction,
  startTime: number,
  nodes: Record<string, InteractionNode> = {},
  status: InteractionStatus,
  elementRef?: string
) => {
  const endTime = pConsole.getTime().valueOf();
  // The trigger itself only fails to run when it is skipped; a step failing further down the flow says nothing
  // about whether the trigger fired.
  const nodeStatus: InteractionNodeStatus = status === 'skipped' ? 'skipped' : 'success';

  const message = (
    <span>
      Interaction triggered <b>{`${triggerNode.title} [${triggerNode.action}]`}</b>
      {elementRef ? (
        <>
          {' on '}
          <b>{elementRef}</b>
        </>
      ) : null}
    </span>
  );

  const params = {
    status,
    node: triggerNode,
    elementId: triggerNode.elementId,
    /**
     * The element the interaction actually ran ON, which is not `node.elementId`: that one carries the SOURCE for
     * a global callback or a utility, so for those it names `space` or `state` rather than anything on the page.
     * Without this, two entries reading `[onLoad]` were indistinguishable — same title, same action, and no way
     * to tell whether one element fired twice or two elements fired once.
     */
    elementRef,
    nodes: {
      ...nodes,
      [triggerNode.id]: {
        node: triggerNode,
        status: nodeStatus,
        result: undefined,
        postCallbacks: [],
        startTime,
        endTime
      }
    },
    startTime,
    endTime
  };

  if (status === 'failed') {
    pConsole.danger('interactions', message, params);

    return;
  }

  pConsole.info('interactions', message, params);
};

// A flow does not stop at a failed step, so its outcome is the worst status any of its steps reported. Without
// this the entry read `completed` whenever the traversal finished, which is exactly what hides a broken step.
const flowStatus = (nodes: Record<string, InteractionNode>): InteractionStatus =>
  Object.values(nodes).some(({ status }) => status === 'failed') ? 'failed' : 'completed';

const flowTrigger = async (
  triggerNode: ElementInteraction,
  nodes = {},
  callbacksAvailables = {},
  flowParams: Record<string, unknown> = {},
  globalParams = {},
  /** The idRef of the element this fired on, carried through purely so the log can name it. */
  elementRef?: string,
  postCallbacksTotal = []
) => {
  const startTime = pConsole.getTime().valueOf();
  const { action, enabled, when } = triggerNode;
  if (!action || !enabled || (when && !QueryBuilderEvaluator(when, { ...globalParams, ...flowParams }))) {
    storeLog(triggerNode, startTime, {}, 'skipped', elementRef);

    return;
  }

  const nodesProcessed = await flowCallbacks(
    triggerNode,
    nodes,
    callbacksAvailables,
    flowParams,
    globalParams,
    postCallbacksTotal,
    {},
    { elementRef }
  );
  storeLog(triggerNode, startTime, nodesProcessed, flowStatus(nodesProcessed), elementRef);
};

// eslint-disable-next-line react-refresh/only-export-components
export { flowTrigger };

const InteractionsHelper = { flowTrigger };

export default InteractionsHelper;
