import ContainerTabs from '@plitzi/plitzi-ui/ContainerTabs';
import { useMemo } from 'react';

import { treeOf } from '@plitzi/sdk-schema/helpers/components';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import DetailsAttributes from '../DetailsAttributes';
import DetailsDefinition from '../DetailsDefinition';
import DetailsRuntime from '../DetailsRuntime';

const tabs = [{ label: 'Runtime' }, { label: 'Definition' }, { label: 'Attributes' }];

export type ElementDetailsProps = {
  id: string;
  onSelectElement: (id: string) => void;
};

/** One element: how it is doing on the page, and what the document says it is — wherever it is, a page or a component. */
const ElementDetails = ({ id, onSelectElement }: ElementDetailsProps) => {
  const [[flat, components]] = useCommonStore(['schema.flat', 'schema.components']);
  const element = useMemo(() => treeOf({ flat, components }, id)?.flat[id], [flat, components, id]);

  return (
    <ContainerTabs className="w-full grow gap-4 overflow-hidden p-4">
      <ContainerTabs.Tabs items={tabs} />
      <ContainerTabs.TabContent className="flex-col overflow-y-auto">
        <DetailsRuntime id={id} />
      </ContainerTabs.TabContent>
      <ContainerTabs.TabContent className="flex-col overflow-y-auto">
        <DetailsDefinition definition={element?.definition} onSelectElement={onSelectElement} />
      </ContainerTabs.TabContent>
      <ContainerTabs.TabContent className="overflow-y-auto">
        <DetailsAttributes attributes={element?.attributes} />
      </ContainerTabs.TabContent>
    </ContainerTabs>
  );
};

export default ElementDetails;
