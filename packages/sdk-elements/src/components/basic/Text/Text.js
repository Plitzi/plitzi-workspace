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
 *   className: string;
 *   content: string | number;
 * }} props
 * @returns {React.ReactElement}
 */
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
