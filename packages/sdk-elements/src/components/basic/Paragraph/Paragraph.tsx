import React, { useMemo, use, useCallback } from 'react';
import classNames from 'classnames';
import Contenteditable from '@plitzi/plitzi-ui-components/ContentEditable/index';

import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

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
    settings: { previewMode },
    contexts: { BuilderContext }
  } = usePlitziServiceContext();
  const builderContext = BuilderContext ? use(BuilderContext) : undefined;
  const finalContent = useMemo(() => {
    if (typeof content !== 'string' && typeof content !== 'number') {
      return JSON.stringify(content);
    }

    if (!content && content !== '' && !previewMode) {
      return 'Paragraph';
    }

    return content;
  }, [content]);

  const handleChange = useCallback(
    value => builderContext?.updateElement(internalProps.id, 'content', value),
    [builderContext?.updateElement, previewMode, internalProps.id]
  );

  return (
    <RootElement
      ref={ref}
      tag={!previewMode ? 'div' : 'p'}
      internalProps={internalProps}
      className={classNames('plitzi-component__paragraph', className)}
    >
      {previewMode && finalContent}
      {!previewMode && (
        <Contenteditable className="" value={finalContent} onChange={handleChange} openMode="doubleClick" />
      )}
    </RootElement>
  );
};

export default withElement(Paragraph);

export { Paragraph };
