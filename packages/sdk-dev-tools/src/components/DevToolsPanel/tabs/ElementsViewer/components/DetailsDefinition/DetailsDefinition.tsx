import DetailsRow from '../DetailsRow';
import DetailsValue from '../DetailsValue';

import type { Element } from '@plitzi/sdk-shared';

export type DetailsDefinitionProps = {
  definition?: Element['definition'];
  onSelectElement: (id: string) => void;
};

const DetailsDefinition = ({ definition, onSelectElement }: DetailsDefinitionProps) => (
  <div className="w-full text-sm">
    {Object.entries(definition ?? {}).map(([key, value]) => (
      <DetailsRow key={key} name={key}>
        <DetailsValue isDefinition attribute={key} value={value} onSelectElement={onSelectElement} />
      </DetailsRow>
    ))}
  </div>
);

export default DetailsDefinition;
