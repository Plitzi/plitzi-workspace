import { get, omit } from '@plitzi/plitzi-ui/helpers';
import { QueryBuilderEvaluator } from '@plitzi/plitzi-ui/QueryBuilder';

import { pConsole } from '@plitzi/sdk-shared/devTools/utils/PlitziConsole';
import { processTwig, hasValidToken } from '@plitzi/sdk-shared/helpers/twigWrapper';

import utility from './utility';

import type { RuleValue } from '@plitzi/plitzi-ui/QueryBuilder';
import type {
  ElementInteraction,
  InteractionCallback,
  InteractionNode,
  InteractionNodeStatus,
  InteractionStatus,
  PostCallbackNode
} from '@plitzi/sdk-shared';

const MAX_TWIG_RESOLUTION_PASSES = 5;

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

  return Object.keys(params).reduce((acum, param) => {
    let value = params[param];
    if (type !== 'trigger') {
      let passes = MAX_TWIG_RESOLUTION_PASSES;
      while (typeof value === 'string' && hasValidToken(value) && passes > 0) {
        value = processTwig(value, { ...flowValues, ...globalValues }, false, true);
        passes--;
      }

      if (typeof value === 'string' && hasValidToken(value)) {
        pConsole.warning(
          'interactions',
          <span>
            Twig token resolution exceeded {MAX_TWIG_RESOLUTION_PASSES} passes for <b>{param}</b>, leaving unresolved
            tokens
          </span>,
          { param, value }
        );
      }
    }

    return { ...acum, [param]: value };
  }, {});
};

const processNode = async (
  node: ElementInteraction,
  callbacksAvailables: Record<string, InteractionCallback> = {},
  flowParams = {},
  globalParams = {}
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
          result = await callback(paramsToCallback);
        }

        if (postCallback) {
          postCallbacks.push({ id, callback: postCallback, params: { ...paramsToCallback, [id]: result } });
        }

        break;
      }

      case 'utility': {
        const { callback, postCallback } = get(utility, action, {}) as InteractionCallback;
        if (callback) {
          result = await callback(paramsToCallback);
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
  executionResults: Record<string, InteractionNode> = {}
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
    globalParams
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
    executionResults
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
    postCallbacksTotal
  );
  storeLog(triggerNode, startTime, nodesProcessed, flowStatus(nodesProcessed), elementRef);
};

// eslint-disable-next-line react-refresh/only-export-components
export { flowTrigger };

const InteractionsHelper = { flowTrigger };

export default InteractionsHelper;
