// Packages
import React, { forwardRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

const Heading = forwardRef((props, ref) => {
  const { internalProps = emptyObject, className = '', content = 'Heading', subType = 'h1' } = props;
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
});

Heading.propTypes = {
  internalProps: PropTypes.object,
  className: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  content: PropTypes.string,
  subType: PropTypes.oneOf(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
};

export default withElement(Heading);

export { Heading };
