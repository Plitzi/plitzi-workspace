// Packages
import React from 'react';
import get from 'lodash/get';
import omit from 'lodash/omit';
import QueryBuilderEvaluator from '@plitzi/plitzi-ui-components/QueryBuilder/helpers/QueryBuilderEvaluator';

// Monorepo
import { processTwig, hasTokens } from '@plitzi/sdk-shared/twigWrapper';
import { pConsole } from '@plitzi/sdk-dev-tools/PlitziConsole';

// Relatives
import utility from './utility';

const processParams = (type, params, flowValues, globalValues, action) => {
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

const processNode = async (node, callbacksAvailables = {}, flowParams = {}, globalParams = {}) => {
  let result = {};
  const postCallbacks = [];
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

      const receptorCallback = get(callbacksAvailables, `${elementId}.${action}`);
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
      const { callback, postCallback } = get(utility, action, {});
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

const processPostCallbacks = async (postCallbacks = []) => {
  const results = {};
  postCallbacks.reverse().forEach(async postCallback => {
    const { id, callback, params } = postCallback;
    const result = await callback(omit(params, [id]), params[id]);
    results[id] = result;
  });

  return results;
};

const flowCallbacks = async (
  parentNode,
  nodes = {},
  callbacksAvailables = {},
  flowParams = {},
  globalParams = {},
  postCallbacksTotal = [],
  executionResults = {}
) => {
  if (!parentNode) {
    return executionResults;
  }

  const node = get(nodes, parentNode.afterNode);
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
  postCallbacksTotal.push(...(postCallbacks ?? []));

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

const storeLog = (triggerNode, startTime, nodes = {}, status = '') => {
  const endTime = pConsole.getTime().valueOf();
  let nodeStatus = 'skipped';
  if (status === 'completed') {
    nodeStatus = 'success';
  }

  pConsole.info(
    'interactions',
    <span>
      Interaction <b>{triggerNode.title}</b> Completed
    </span>,
    {
      status,
      node: triggerNode,
      elementId: triggerNode?.elementId,
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
  triggerNode,
  nodes = {},
  callbacksAvailables = {},
  flowParams = {},
  globalParams = {},
  postCallbacksTotal = []
) => {
  const startTime = pConsole.getTime().valueOf();
  const { action, enabled, when } = triggerNode;
  if (!action || !enabled || (when && !QueryBuilderEvaluator(when, { ...globalParams, ...flowParams }))) {
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

export { flowTrigger };

const InteractionsHelper = { flowTrigger };

export default InteractionsHelper;
