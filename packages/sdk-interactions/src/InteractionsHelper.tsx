import { QueryBuilderEvaluator } from '@plitzi/plitzi-ui/QueryBuilder';
import get from 'lodash/get';
import omit from 'lodash/omit';

import { pConsole } from '@plitzi/sdk-dev-tools/utils/PlitziConsole';
import { processTwig, hasTokens } from '@plitzi/sdk-shared/helpers/twigWrapper';

import utility from './utility';

import type { RuleValue } from '@plitzi/plitzi-ui/QueryBuilder';
import type {
  ElementInteraction,
  InteractionCallback,
  InteractionBaseCallback,
  InteractionNode,
  InteractionNodeStatus,
  InteractionStatus,
  PostCallbackNode
} from '@plitzi/sdk-shared';

const processParams = (
  type: InteractionBaseCallback['type'],
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
      let timeout = 5;
      while (typeof value === 'string' && hasTokens(value) && timeout > 0) {
        value = processTwig(value, { ...flowValues, ...globalValues }, false, true);
        timeout--;
      }
    }

    return { ...acum, [param]: value };
  }, {});
};

const processNode = async (
  node: ElementInteraction,
  callbacksAvailables: Record<string, InteractionBaseCallback> = {},
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
  switch (type) {
    case 'callback':
    case 'globalCallback': {
      if (!elementId) {
        return { status: 'failed', result, postCallbacks, whenParams };
      }

      const receptorCallback = get(callbacksAvailables, `${elementId}.${action}`) as InteractionCallback | undefined;
      if (!receptorCallback) {
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

const storeLog = (triggerNode: ElementInteraction, startTime: number, nodes = {}, status: InteractionStatus) => {
  const endTime = pConsole.getTime().valueOf();
  let nodeStatus = 'skipped';
  if (status === 'completed') {
    nodeStatus = 'success';
  }

  pConsole.info(
    'interactions',
    <span>
      Interaction <b>{`${triggerNode.title} [${triggerNode.action}]`}</b> Completed
    </span>,
    {
      status,
      node: triggerNode,
      elementId: triggerNode.elementId,
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
    }
  );
};

const flowTrigger = async (
  triggerNode: ElementInteraction,
  nodes = {},
  callbacksAvailables = {},
  flowParams: Record<string, unknown> = {},
  globalParams = {},
  postCallbacksTotal = []
) => {
  const startTime = pConsole.getTime().valueOf();
  const { action, enabled, when } = triggerNode;
  if (
    !action ||
    !enabled ||
    (when && !QueryBuilderEvaluator(when, { ...globalParams, ...flowParams } as Record<string, RuleValue>))
  ) {
    storeLog(triggerNode, startTime, {}, 'skipped');

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
  storeLog(triggerNode, startTime, nodesProcessed, 'completed');
};

// eslint-disable-next-line react-refresh/only-export-components
export { flowTrigger };

const InteractionsHelper = { flowTrigger };

export default InteractionsHelper;
