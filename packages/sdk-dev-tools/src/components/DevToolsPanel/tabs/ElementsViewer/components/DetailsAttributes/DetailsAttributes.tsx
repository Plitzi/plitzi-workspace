import DetailsRow from '../DetailsRow';
import DetailsValue from '../DetailsValue';

import type { Element } from '@plitzi/sdk-shared';

export type DetailsAttributesProps = {
  attributes?: Element['attributes'];
};

const DetailsAttributes = ({ attributes = {} }: DetailsAttributesProps) => (
  <div className="w-full text-sm">
    {Object.entries(attributes).map(([key, value]) => (
      <DetailsRow key={key} name={key}>
        <DetailsValue attribute={key} value={value} />
      </DetailsRow>
    ))}
  </div>
);

export default DetailsAttributes;
