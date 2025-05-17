// Packages
import React, { useCallback } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import get from 'lodash/get';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';

// Relatives
import NodeBodyParam from './NodeBodyParam';

/**
 * @param {{
 *   className?: string;
 *   id?: string;
 *   params?: object;
 *   paramDefinitions?: object;
 *   fields?: object;
 *   onChange?: (params: object) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const NodeBody = props => {
  const {
    className = '',
    id = '',
    params = emptyObject,
    paramDefinitions = emptyObject,
    fields = emptyObject,
    onChange = noop
  } = props;

  const handleChange = useCallback(
    (key, value) => onChange({ params: { ...params, [key]: value } }),
    [params, onChange]
  );

  return (
    <div className={classNames('flex items-center p-2 w-full', className)}>
      <div className="flex flex-col w-full">
        {paramDefinitions &&
          Object.keys(paramDefinitions).map(param => {
            const paramDefinition = paramDefinitions[param];
            if (typeof paramDefinition === 'string') {
              const value = get(params, param, '');

              return (
                <NodeBodyParam
                  key={param}
                  nodeId={id}
                  input="text"
                  id={param}
                  value={value}
                  fields={fields}
                  onChange={handleChange}
                />
              );
            }

            if (typeof paramDefinition !== 'object') {
              return undefined;
            }

            const { defaultValue, options = [], when, canBind, label } = paramDefinition;
            const value = get(params, param, defaultValue);
            if (typeof when === 'function' && !when(params)) {
              return undefined;
            }

            let { type } = paramDefinition;
            if (typeof type === 'function') {
              type = type(params);
            }

            return (
              <NodeBodyParam
                key={param}
                id={param}
                nodeId={id}
                label={label}
                value={value}
                type={type}
                when={when}
                canBind={canBind}
                onChange={handleChange}
                options={options}
                params={params}
                fields={fields}
              />
            );
          })}
        {Object.keys(paramDefinitions).length === 0 && (
          <div className="flex items-center justify-center">No parameters</div>
        )}
      </div>
    </div>
  );
};

export default NodeBody;
