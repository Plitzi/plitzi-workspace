// Packages
import React, { forwardRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relatives
import usePlitziServiceContext from '../../../services/hooks/usePlitziServiceContext';

const Text = forwardRef((props, ref) => {
  const { content = 'Text', className = '', internalProps = emptyObject } = props;
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();
  const finalContent = useMemo(() => {
    if (typeof content !== 'string' && typeof content !== 'number') {
      return JSON.stringify(content);
    }

    if (!content && content !== '' && !previewMode) {
      return 'Text';
    }

    return content;
  }, [content, previewMode]);

  return (
    <RootElement ref={ref} internalProps={internalProps} className={classNames('plitzi-component__text', className)}>
      {finalContent}
    </RootElement>
  );
});

Text.propTypes = {
  internalProps: PropTypes.object,
  className: PropTypes.string,
  content: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
};

export default withElement(Text);

export { Text };
