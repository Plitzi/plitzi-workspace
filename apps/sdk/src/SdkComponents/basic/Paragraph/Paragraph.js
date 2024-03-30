// Packages
import React, { forwardRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

const Paragraph = forwardRef((props, ref) => {
  const { content = 'Paragraph', className = '', internalProps = emptyObject } = props;
  const finalContent = useMemo(() => {
    if (typeof content !== 'string' && typeof content !== 'number') {
      return JSON.stringify(content);
    }

    return content;
  }, [content]);

  return (
    <RootElement
      ref={ref}
      tag="p"
      internalProps={internalProps}
      className={classNames('plitzi-component__paragraph', className)}
    >
      {finalContent || 'Paragraph'}
    </RootElement>
  );
});

Paragraph.propTypes = {
  className: PropTypes.string,
  internalProps: PropTypes.object,
  content: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
};

export default withElement(Paragraph);

export { Paragraph };
