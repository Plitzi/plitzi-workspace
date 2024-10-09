// Packages
import React from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import ContainerTabs from '@plitzi/plitzi-ui-components/ContainerTabs';

// Relatives
import DetailsDefinition from './DetailsDefinition';
import DetailsAttributes from './DetailsAttributes';

const tabs = [{ label: 'Definition' }, { label: 'Attributes' }]; // , { label: 'Style' }

/**
 * @param {{
 *   className?: string;
 *   definition?: object;
 *   attributes?: object;
 *   onSelectElement: (id: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const ElementDetails = props => {
  const { className, definition, attributes, onSelectElement = noop } = props;

  return (
    <ContainerTabs className={classNames('flex flex-col p-4 w-full overflow-hidden gap-4', className)}>
      <ContainerTabs.Tabs items={tabs} />
      <ContainerTabs.TabContent className="flex flex-col">
        <DetailsDefinition definition={definition} onSelectElement={onSelectElement} />
      </ContainerTabs.TabContent>
      <ContainerTabs.TabContent>
        <DetailsAttributes attributes={attributes} />
      </ContainerTabs.TabContent>
      {/* <ContainerTabs.TabContent>Style</ContainerTabs.TabContent> */}
    </ContainerTabs>
  );
};

export default ElementDetails;
