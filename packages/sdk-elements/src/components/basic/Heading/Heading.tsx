/* eslint-disable react-refresh/only-export-components */
import Contenteditable from '@plitzi/plitzi-ui/ContentEditable';
import classNames from 'classnames';
import { useMemo, use, useCallback } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { InternalProps } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type HeadingProps = {
  ref?: RefObject<HTMLElement>;
  internalProps?: InternalProps;
  className?: string;
  content?: string;
  subType?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
};

const Heading = ({
  ref,
  internalProps = emptyObject as InternalProps,
  className = '',
  content = 'Heading',
  subType = 'h1'
}: HeadingProps) => {
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
  }, [content, previewMode]);

  const handleChange = useCallback(
    (value: string) => builderContext?.updateElement(internalProps.id, 'content', value),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [builderContext?.updateElement, internalProps.id]
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
