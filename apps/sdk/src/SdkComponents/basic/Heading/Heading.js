// Packages
import React, { useMemo } from 'react';
import classNames from 'classnames';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

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
