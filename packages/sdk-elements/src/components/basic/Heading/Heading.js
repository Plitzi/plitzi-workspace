// Packages
import React, { useMemo } from 'react';
import classNames from 'classnames';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import RootElement from '../../../Element/RootElement';
import withElement from '../../../Element/hocs/withElement';

/**
 * @param {{
 *   ref: React.MutableRefObject<HTMLElement>;
 *   internalProps: object;
 *   className: string;
 *   content: string | number;
 *   subType: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
 * }} props
 * @returns {React.ReactElement}
 */
const Heading = props => {
  const { ref, internalProps = emptyObject, className = '', content = 'Heading', subType = 'h1' } = props;
  const finalContent = useMemo(() => {
    if (typeof content !== 'string' && typeof content !== 'number') {
      return JSON.stringify(content);
    }

    return content;
  }, [content]);

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      tag={subType}
      className={classNames(
        'plitzi-component__heading',
        { [`plitzi-component__heading-${subType}`]: subType },
        className
      )}
    >
      {finalContent || 'Heading'}
    </RootElement>
  );
};

export default withElement(Heading);

export { Heading };
