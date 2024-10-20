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
 *   subType: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
 * }} props
 * @returns {React.ReactElement}
 */
const Heading = props => {
  const { ref, internalProps = emptyObject, className = '', content = 'Heading', subType = 'h1' } = props;
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
      return 'Heading';
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
      internalProps={internalProps}
      tag={!previewMode ? 'div' : subType}
      className={classNames(
        'plitzi-component__heading',
        { [`plitzi-component__heading-${subType}`]: subType },
        className
      )}
    >
      {previewMode && finalContent}
      {!previewMode && (
        <Contenteditable className="" value={finalContent} onChange={handleChange} openMode="doubleClick" />
      )}
    </RootElement>
  );
};

export default withElement(Heading);

export { Heading };
