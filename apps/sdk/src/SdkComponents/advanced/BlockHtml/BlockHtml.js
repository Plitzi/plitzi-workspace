// Packages
import React, { forwardRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import dompurify from 'dompurify';
import classNames from 'classnames';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relatives
import { emptyObject } from '../../../helpers/utils';

const BlockHtml = forwardRef((props, ref) => {
  const { content = '', className = '', internalProps = emptyObject } = props;
  const contentCleaned = useMemo(() => dompurify.sanitize(content), [content]);

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__block-html', className, {
        'block-html--empty': content === '' || !content
      })}
      dangerouslySetInnerHTML={{ __html: contentCleaned }} // eslint-disable-line react/no-danger
    />
  );
});

BlockHtml.propTypes = {
  internalProps: PropTypes.object,
  className: PropTypes.string,
  content: PropTypes.string
};

export default withElement(BlockHtml);

export { BlockHtml };
