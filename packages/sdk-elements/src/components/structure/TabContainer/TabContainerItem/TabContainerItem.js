// Packages
import React, { useCallback } from 'react';
import classNames from 'classnames';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import RootElement from '../../../../Element/RootElement';
import withElement from '../../../../Element/hocs/withElement';

/**
 * @param {{
 *   ref: React.MutableRefObject<HTMLElement>;
 *   className: string;
 *   internalProps: object;
 *   children: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const TabContainerItem = props => {
  const { className = '', internalProps = emptyObject, children, ref } = props;
  const { tabSelected, tabIndex = 0, isHeader, onSelect } = internalProps;

  const handleClick = useCallback(() => {
    if (!isHeader || tabSelected === tabIndex) {
      return;
    }

    onSelect(tabIndex);
  }, [isHeader, tabSelected, tabIndex, onSelect]);

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      onClick={handleClick}
      className={classNames('plitzi-component__tab-container-item', className, {
        active: tabSelected === tabIndex
      })}
    >
      {children}
    </RootElement>
  );
};

export default withElement(TabContainerItem);

export { TabContainerItem };
