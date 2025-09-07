import ContainerTabs from '@plitzi/plitzi-ui/ContainerTabs';

import DetailsAttributes from './DetailsAttributes';
import DetailsDefinition from './DetailsDefinition';

import type { Element } from '@plitzi/sdk-shared';

const tabs = [{ label: 'Definition' }, { label: 'Attributes' }]; // , { label: 'Style' }

export type ElementDetailsProps = {
  definition?: Element['definition'];
  attributes?: Element['attributes'];
  onSelectElement: (id: string) => void;
};

const ElementDetails = ({ definition, attributes, onSelectElement }: ElementDetailsProps) => (
  <ContainerTabs className="grow p-4 w-full overflow-hidden gap-4">
    <ContainerTabs.Tabs items={tabs} />
    <ContainerTabs.TabContent className="flex-col">
      <DetailsDefinition definition={definition} onSelectElement={onSelectElement} />
    </ContainerTabs.TabContent>
    <ContainerTabs.TabContent>
      <DetailsAttributes attributes={attributes} />
    </ContainerTabs.TabContent>
    {/* <ContainerTabs.TabContent>Style</ContainerTabs.TabContent> */}
  </ContainerTabs>
);

export default ElementDetails;
