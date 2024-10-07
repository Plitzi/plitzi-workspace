// Packages
import React from 'react';
import classNames from 'classnames';

// Relatives
import ContainerTabs from '../../../ContainerTabs';

/**
 * @param {{
 *   className?: string;
 *   element?: object;
 * }} props
 * @returns {React.ReactElement}
 */
const ElementDetails = props => {
  const { className, element } = props;

  // terminar esto

  return (
    <div className={classNames('flex flex-col p-4', className)}>
      <ContainerTabs>
        <ContainerTabs.Tabs
          items={[
            { id: 'definition', label: 'Definition' },
            { id: 'attributes', label: 'Attributes' },
            { id: 'style', label: 'Style' }
          ]}
        />
        <div>
          {/* <ContainerTabs.Content id="definition">Definition</ContainerTabs.Content>
          <ContainerTabs.Content id="attributes">Attributes</ContainerTabs.Content>
          <ContainerTabs.Content id="style">Style</ContainerTabs.Content> */}
        </div>
      </ContainerTabs>
    </div>
  );
};

export default ElementDetails;
