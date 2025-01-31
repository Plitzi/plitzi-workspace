// Packages
import React, { useMemo, use, useCallback } from 'react';
import classNames from 'classnames';
import Contenteditable from '@plitzi/plitzi-ui-components/ContentEditable/index.js';

// Monorepo
import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import RootElement from '../../../Element/RootElement.js';
import withElement from '../../../Element/hocs/withElement.js';

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
    settings: { previewMode },
    contexts: { BuilderContext }
  } = usePlitziServiceContext();
  const builderContext = BuilderContext ? use(BuilderContext) : undefined;
  const finalContent = useMemo(() => {
    if (typeof content !== 'string' && typeof content !== 'number') {
      return JSON.stringify(content);
    }

    if (!content && content !== '' && !previewMode) {
      return 'Text';
    }

    return content;
  }, [content]);

  const handleChange = useCallback(
    value => builderContext?.updateElement(internalProps.id, 'content', value),
    [builderContext?.updateElement, previewMode, internalProps.id]
  );

  return (
    <RootElement ref={ref} internalProps={internalProps} className={classNames('plitzi-component__text', className)}>
      {previewMode && finalContent}
      {!previewMode && (
        <Contenteditable
          className="focus-visible:outline-hidden"
          value={finalContent}
          onChange={handleChange}
          openMode="doubleClick"
        />
      )}
    </RootElement>
  );
};

export default withElement(Text);

export { Text };
