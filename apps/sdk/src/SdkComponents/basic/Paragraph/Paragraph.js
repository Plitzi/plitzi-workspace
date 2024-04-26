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

const Paragraph = props => {
  const { ref, content = 'Paragraph', className = '', internalProps = emptyObject } = props;
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();
  const finalContent = useMemo(() => {
    if (typeof content !== 'string' && typeof content !== 'number') {
      return JSON.stringify(content);
    }

    if (!content && content !== '' && !previewMode) {
      return 'Paragraph';
    }

    return content;
  }, [content, previewMode]);

  return (
    <RootElement
      ref={ref}
      tag="p"
      internalProps={internalProps}
      className={classNames('plitzi-component__paragraph', className)}
    >
      {finalContent}
    </RootElement>
  );
};

export default withElement(Paragraph);

export { Paragraph };
