// Packages
import React from 'react';
import classNames from 'classnames';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

const TabContainerHeader = props => {
  const { ref, className = '', internalProps = emptyObject, children } = props;
  const { onSelect, tabSelected } = internalProps;

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__tab-container-header', className)}
    >
      {Array.isArray(children) &&
        children.map((child, i) =>
          React.cloneElement(child, {
            ...child.props,
            internalProps: { isHeader: true, onSelect, tabSelected, tabIndex: i }
          })
        )}
    </RootElement>
  );
};

export default withElement(TabContainerHeader);

export { TabContainerHeader };
