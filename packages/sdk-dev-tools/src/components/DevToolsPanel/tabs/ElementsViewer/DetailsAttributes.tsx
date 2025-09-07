import DetailsValue from './DetailsValue';

import type { Element } from '@plitzi/sdk-shared';

export type DetailsAttributesProps = {
  attributes?: Element['attributes'];
};

const DetailsAttributes = ({ attributes }: DetailsAttributesProps) => (
  <div className="w-full text-sm">
    {attributes &&
      Object.entries(attributes).map(([key, value], i) => (
        <div key={i} className="flex gap-4 border-gray-300 [&:not(:first-child)]:border-t">
          <div className="grow basis-0">{key}</div>
          <DetailsValue isAttribute attribute={key} value={value} />
        </div>
      ))}
  </div>
);

export default DetailsAttributes;
