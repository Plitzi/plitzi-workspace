// Packages
import React, { forwardRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relative
import { emptyObject } from '../../../helpers/utils';

const Heading = forwardRef((props, ref) => {
  const { internalProps = emptyObject, className = '', content = 'Heading', subType = 'h1' } = props;

  const interactionTriggers = useMemo(() => ({ onClick: { title: 'On Click', params: {} } }), []);

  const contentMemo = useMemo(() => {
    if (typeof content !== 'string' || content === '') {
      return 'Heading';
    }

    return content;
  }, [content]);

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      tag={subType}
      interactionTriggers={interactionTriggers}
      className={classNames(
        'plitzi-component__heading',
        { [`plitzi-component__heading-${subType}`]: subType },
        className
      )}
    >
      {contentMemo}
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
