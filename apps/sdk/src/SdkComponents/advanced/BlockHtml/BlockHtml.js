// eslint-disable-file react/no-danger

// Packages
import React, { forwardRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import dompurify from 'dompurify';
import classNames from 'classnames';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relatives
import usePlitziServiceContext from '../../../services/hooks/usePlitziServiceContext';

const BlockHtml = forwardRef((props, ref) => {
  const { content = '', className = '', internalProps = emptyObject } = props;
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();
  const contentCleaned = useMemo(() => dompurify.sanitize(content), [content]);

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__block-html', className, {
        'block-html--empty': content === '' || !content
      })}
      dangerouslySetInnerHTML={{ __html: !previewMode ? contentCleaned : content }}
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
