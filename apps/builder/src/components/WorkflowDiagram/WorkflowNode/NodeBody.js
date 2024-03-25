// Packages
import React, { useCallback } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import get from 'lodash/get';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import NodeBodyParam from './NodeBodyParam';

const NodeBody = props => {
  const { className = '', params = emptyObject, paramDefinitions = emptyObject, onChange = noop } = props;

  const handleChange = useCallback(
    (key, value) => onChange({ params: { ...params, [key]: value } }),
    [params, onChange]
  );

  return (
    <div className={classNames('flex items-center px-4 pb-4 w-full', className)}>
      <div className="flex flex-col w-full">
        {paramDefinitions &&
          Object.keys(paramDefinitions).map(param => {
            const paramDefinition = paramDefinitions[param];
            if (!paramDefinition) {
              return undefined;
            }

            const value = get(params, param, defaultValue);
            if (typeof paramDefinition === 'string') {
              return <NodeBodyParam key={param} input="text" id={param} value={value} onChange={handleChange} />;
            }

            const { defaultValue, options, when } = paramDefinition;
            if (typeof when === 'function' && !when(params)) {
              return undefined;
            }

            let { type } = paramDefinition;
            if (typeof type === 'function') {
              type = type(params);
            }

            let optionsFinal = options;
            if (typeof options === 'function') {
              optionsFinal = options(params);
            }

            return (
              <NodeBodyParam
                key={param}
                id={param}
                value={value}
                type={type}
                when={when}
                onChange={handleChange}
                options={optionsFinal}
              />
            );
          })}
      </div>
    </div>
  );
};

NodeBody.propTypes = {
  className: PropTypes.string,
  paramDefinitions: PropTypes.object,
  params: PropTypes.object,
  onChange: PropTypes.func
};

export default NodeBody;
