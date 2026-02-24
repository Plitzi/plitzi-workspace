import { get } from '@plitzi/plitzi-ui/helpers';
import { useCallback, useMemo } from 'react';

import NodeBodyParam from './NodeBodyParam';

import type { ElementInteraction, InteractionCallbackParam, InteractionCallbackParamValues } from '@plitzi/sdk-shared';

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

  const definitionsParsed = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(paramDefinitions).filter(([, paramDefinition]) => {
          if (
            !(paramDefinition as typeof paramDefinition | undefined) ||
            (typeof paramDefinition !== 'object' && typeof paramDefinition !== 'string')
          ) {
            return false;
          }

          return typeof paramDefinition.when === 'function' ? paramDefinition.when(params ?? {}) : true;
        })
      ),
    [paramDefinitions, params]
  );

  return (
    <div className="flex w-full items-center p-2">
      <div className="flex w-full flex-col">
        {(Object.keys(definitionsParsed) as (keyof ElementInteraction)[]).map(param => {
          const paramDefinition = definitionsParsed[param];
          if (typeof paramDefinition === 'string') {
            return (
              <NodeBodyParam
                key={param}
                nodeId={id}
                id={param}
                value={get(params, param, '') as string | number | boolean}
                fields={fields}
                onChange={handleChange}
              />
            );
          }

          return (
            <NodeBodyParam
              key={param}
              id={param}
              nodeId={id}
              label={paramDefinition.label}
              value={get(params, param, paramDefinition.defaultValue) as string | number | boolean}
              type={paramDefinition.type}
              canBind={paramDefinition.canBind}
              onChange={handleChange}
              options={'options' in paramDefinition ? paramDefinition.options : undefined}
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
