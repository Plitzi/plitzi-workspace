// Packages
import isEmpty from 'lodash/isEmpty';
import camelCase from 'lodash/camelCase';
import get from 'lodash/get';
import set from 'lodash/set';
import { produce } from 'immer';
import QueryBuilderEvaluator from '@plitzi/plitzi-ui-components/QueryBuilder/helpers/QueryBuilderEvaluator';

// Relatives
import utility from '../utility';

const getValue = (dataSource, source, path, result, bkey, attrKey) => {
  if (bkey === 'initialState') {
    return get(dataSource, `${source}.${path}`, get(result, `definition.${bkey}.${attrKey}`));
  }

  return get(dataSource, `${source}.${path}`, get(result, `${bkey}.${attrKey}`));
};

const getBindingsDetails = (dataSource, attributes = {}, definition = {}) => {
  const { bindings } = definition;
  if (!bindings || (typeof bindings === 'object' && Object.keys(bindings).length === 0)) {
    return { attributes, style: {}, definition };
  }

  return produce({ attributes: { ...attributes }, style: {}, definition: { ...definition } }, draft => {
    Object.keys(bindings).forEach(bkey => {
      if (!Array.isArray(bindings[bkey]) || bindings[bkey].length === 0) {
        return;
      }

      bindings[bkey].forEach(binding => {
        if (binding) {
          const { source, fromPath, transformers, when, enabled = true } = binding;
          let { toPath } = binding;
          if (!source || !fromPath || !toPath || (when && !QueryBuilderEvaluator(when, dataSource)) || !enabled) {
            return;
          }

          if (bkey === 'style') {
            toPath = camelCase(toPath);
          }

          let value = getValue(dataSource, source, fromPath, draft, bkey, toPath);
          if (transformers && Array.isArray(transformers) && transformers.length > 0) {
            transformers.forEach(transformer => {
              const { type, action, params } = transformer;
              switch (type) {
                case 'utility': {
                  const callback = get(utility, `${action}.callback`);
                  if (!callback || typeof callback !== 'function') {
                    break;
                  }

                  value = callback(value, params, dataSource);
                  break;
                }

                default:
              }
            });
          }

          if (typeof value === 'boolean' || typeof value === 'number' || !isEmpty(value)) {
            if (bkey === 'initialState') {
              set(draft, `definition.${bkey}.${toPath}`, value);
            } else {
              set(draft, `${bkey}.${toPath}`, value);
            }
          }
        }
      });
    });
  });
};

export default getBindingsDetails;
