import DetailsValue from './DetailsValue';

import type { Element } from '@plitzi/sdk-shared';

export type DetailsDefinitionProps = {
  definition?: Element['definition'];
  onSelectElement: (id: string) => void;
};

const DetailsDefinition = ({ definition, onSelectElement }: DetailsDefinitionProps) => (
  <div className="w-full text-sm">
    {definition &&
      Object.entries(definition).map(([key, value], i) => (
        <div key={i} className="flex gap-4 border-gray-300 [&:not(:first-child)]:border-t">
          <div className="grow basis-0">{key}</div>
          <DetailsValue isDefinition attribute={key} value={value} onSelectElement={onSelectElement} />
        </div>
      ))}
  </div>
);

export default DetailsDefinition;
