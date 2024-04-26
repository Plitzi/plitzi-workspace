// Packages
import React, { useMemo } from 'react';
import classNames from 'classnames';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relatives
import usePlitziServiceContext from '../../../services/hooks/usePlitziServiceContext';

const Text = props => {
  const { ref, content = 'Text', className = '', internalProps = emptyObject } = props;
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
};

export default withElement(Text);

export { Text };
