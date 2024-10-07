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

  return (
    <div className={classNames('flex flex-col p-4', className)}>
      <ContainerTabs>
        <ContainerTabs.Tabs items={[{ label: 'Definition' }, { label: 'Attributes' }, { label: 'Style' }]} />
      </ContainerTabs>
    </div>
  );
};

export default ElementDetails;
