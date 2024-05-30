// Packages
import React, { useMemo } from 'react';
import classNames from 'classnames';

// Monorepo
import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import RootElement from '../../../Element/RootElement';
import withElement from '../../../Element/hocs/withElement';

/**
 * @param {{
 *   ref: React.MutableRefObject<HTMLElement>;
 *   internalProps: object;
 *   content: string | number;
 *   className: string;
 * }} props
 * @returns {React.ReactElement}
 */
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
