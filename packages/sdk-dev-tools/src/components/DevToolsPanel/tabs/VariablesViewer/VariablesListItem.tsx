import VariableValue from './VariableValue';

import type { ColorScheme, StyleVariableValue } from '@plitzi/sdk-shared';

export type VariablesListItemProps = {
  name?: string;
  type?: string;
  value?: StyleVariableValue;
};

const VariablesListItem = ({ name, type, value = '' }: VariablesListItemProps) => {
  return (
    <div className="border-ui-line hover:bg-ui-hover grid grid-cols-[1fr_1.5fr] items-center border-b px-3 py-1.5 transition-colors">
      <div className="flex min-w-0 flex-col gap-0.5 pr-2">
        <span className="text-ui-fg truncate font-medium" title={name}>
          {name}
        </span>
        <span className="text-ui-fg-subtle text-[10px] tracking-wider uppercase">{type}</span>
      </div>

      <div className="flex min-w-0 flex-col gap-0.5">
        {(typeof value === 'string' || typeof value === 'number') && (
          <VariableValue type={type} value={value as string} />
        )}
        {typeof value === 'object' &&
          Object.keys(value).map((valueKey, i) => (
            <VariableValue
              key={i}
              type={type}
              preffix={`${valueKey}:`}
              value={value[valueKey as ColorScheme | 'default']}
            />
          ))}
      </div>
    </div>
  );
};

export default VariablesListItem;
