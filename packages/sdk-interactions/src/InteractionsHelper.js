// Packages
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
    return { result, postCallbacks };
  }

  if (when && !QueryBuilderEvaluator(when, { ...globalParams, ...flowParams, [id]: params })) {
    pConsole.info('interactions', 'Callback Skipped', { status: 'skipped', result, node, paramsToCallback });

    return { result, postCallbacks };
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
        return { result, postCallbacks };
      }

      const receptorCallback = get(callbacksAvailables, `${elementId}.${action}`);
      if (!receptorCallback) {
        return { result, postCallbacks };
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

  pConsole.info('interactions', 'Callback Success', {
    nodeType: 'trigger',
    status: 'success',
    result,
    node,
    paramsToCallback
  });

  return { result, postCallbacks };
};

const processPostCallbacks = async (postCallbacks = []) => {
  postCallbacks.reverse().forEach(async postCallback => {
    const { id, callback, params } = postCallback;
    const result = await callback(omit(params, [id]), params[id]);
    pConsole.info('interactions', 'postCallback Success', {
      nodeType: 'trigger',
      result,
      node: undefined,
      paramsToCallback: params[id]
    });
  });

  return;
};

const flowCallbacks = async (
  parentNode,
  nodes = {},
  callbacksAvailables = {},
  flowParams = {},
  globalParams = {},
  postCallbacksTotal = []
) => {
  if (!parentNode) {
    return;
  }

  const node = get(nodes, parentNode.afterNode);
  if (!node && postCallbacksTotal.length > 0) {
    await processPostCallbacks(postCallbacksTotal);
  }

  if (!node) {
    return;
  }

  const { result, postCallbacks } = await processNode(node, callbacksAvailables, flowParams, globalParams);
  postCallbacksTotal.push(...(postCallbacks ?? []));

  await flowCallbacks(
    node,
    nodes,
    callbacksAvailables,
    { ...flowParams, [node.id]: result },
    globalParams,
    postCallbacksTotal
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
  const { action, enabled, when } = triggerNode;
  if (!action || !enabled || (when && !QueryBuilderEvaluator(when, { ...globalParams, ...flowParams }))) {
    pConsole.info('interactions', 'Trigger Skipped', { nodeType: 'trigger', status: 'skipped', node: triggerNode });

    return;
  }

  pConsole.info('interactions', 'Trigger Success', { nodeType: 'trigger', status: 'success', node: triggerNode });
  await flowCallbacks(triggerNode, nodes, callbacksAvailables, flowParams, globalParams, postCallbacksTotal);
};

export { flowTrigger };
