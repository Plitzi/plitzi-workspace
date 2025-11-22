import get from 'lodash-es/get';
import { useCallback } from 'react';

import NodeBodyParam from './NodeBodyParam';

import type {
  ElementInteraction,
  InteractionCallbackParam,
  InteractionCallbackParamOption,
  InteractionCallbackParamValues
} from '@plitzi/sdk-shared';

export type NodeBodyProps = {
  id?: string;
  params?: InteractionCallbackParamValues;
  paramDefinitions: Record<string, InteractionCallbackParam>;
  fields: Record<string, { name: string; label: string; placeholder: string; group: string }>;
  onChange?: (params: Partial<ElementInteraction>) => void;
};

const NodeBody = ({ id = '', params, paramDefinitions, fields, onChange }: NodeBodyProps) => {
  const handleChange = useCallback(
    (key: keyof ElementInteraction, value: string | number | boolean) =>
      onChange?.({ params: { ...params, [key]: value } }),
    [params, onChange]
  );

  return (
    <div className="flex w-full items-center p-2">
      <div className="flex w-full flex-col">
        {Object.keys(paramDefinitions).map(param => {
          const paramDefinition = paramDefinitions[param];
          if (typeof paramDefinition === 'string') {
            const value = get(params, param, '');

            return (
              <NodeBodyParam
                key={param}
                nodeId={id}
                type="text"
                id={param as keyof ElementInteraction}
                value={value as string | number | boolean}
                fields={fields}
                onChange={handleChange}
              />
            );
          }

          if (typeof paramDefinition !== 'object') {
            return undefined;
          }

          const { defaultValue, canBind, label } = paramDefinition;
          const value = get(params, param, defaultValue);
          let { type } = paramDefinition;
          if (typeof type === 'function') {
            type = type(params ?? {});
          }

          let options: InteractionCallbackParamOption[] = [];
          if (paramDefinition.type === 'select' && typeof paramDefinition.options === 'function') {
            options = paramDefinition.options(params ?? {});
          } else if (paramDefinition.type === 'select' && typeof paramDefinition.options !== 'function') {
            options = paramDefinition.options;
          }

          return (
            <NodeBodyParam
              key={param}
              id={param as keyof ElementInteraction}
              nodeId={id}
              label={label}
              value={value as boolean | number | string}
              type={type}
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
